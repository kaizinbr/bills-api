import { NextResponse, NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db/index";
import {
    group as groupTable,
    card as cardTable,
    groupMember as groupMemberTable,
} from "@/db/drizzle/schema";
import { getOrCreateInvoice } from "@/lib/invoices";
import { generateUniqueInviteCode } from "@/lib/invites";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.query.group.findMany({
        where: {
            groupMembers: { userId: session.user.id },
        },
        with: {
            cards: true,
            userDebtorId: { columns: { id: true, name: true, image: true } },
            invoices: { orderBy: { periodStart: "desc" }, limit: 1 },
            groupMembers: {
                with: {
                    user: { columns: { id: true, name: true, image: true } },
                },
            },
            installmentPlans: true,
            subscriptions: { columns: { id: true } },
        },
    });

    // recria o `_count` do Prisma e não devolve a lista de subscriptions
    const groups = rows.map(({ subscriptions, ...group }) => ({
        ...group,
        _count: {
            subscriptions: subscriptions.length,
            cards: group.cards.length,
            installmentPlans: group.installmentPlans.length,
        },
    }));

    const now = new Date();

    await Promise.all(
        groups.flatMap((group) => [
            getOrCreateInvoice({
                groupId: group.id,
                targetDate: now,
            }),
            ...group.cards.map((card) =>
                getOrCreateInvoice({
                    groupId: group.id,
                    targetDate: now,
                }),
            ),
        ]),
    );

    return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, amount, payerId, receiverId, closingDay, archived, cards } = body;
    const cardIds: string[] = Array.isArray(cards) ? cards : [];

    const safePayerId =
        typeof payerId === "string" && payerId.trim()
            ? payerId
            : session.user.id;
    const safeReceiverId =
        typeof receiverId === "string" && receiverId.trim()
            ? receiverId
            : session.user.id;

    if (!name || typeof name !== "string") {
        return NextResponse.json(
            { error: "Group name is required" },
            { status: 400 },
        );
    }

    const inviteCode = await generateUniqueInviteCode();

    const newGroup = await db.transaction(async (tx) => {
        const [group] = await tx
            .insert(groupTable)
            .values({
                name,
                limit: amount,
                creditorId: safePayerId,
                debtorId: safeReceiverId,
                closingDay,
                inviteCode,
                archived: Boolean(archived),
            })
            .returning();

        // equivalente ao `connect` do Prisma
        if (cardIds.length > 0) {
            await tx
                .update(cardTable)
                .set({ groupId: group.id })
                .where(inArray(cardTable.id, cardIds));
        }

        // quem criou a conta vira membro com acesso total (owner)
        await tx.insert(groupMemberTable).values({
            groupId: group.id,
            userId: session.user.id,
            role: "OWNER",
        });

        return group;
    });

    await getOrCreateInvoice({
        groupId: newGroup.id,
        targetDate: new Date(),
    });

    return NextResponse.json(newGroup, { status: 201 });
}