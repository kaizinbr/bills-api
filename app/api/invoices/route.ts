import { NextResponse, NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { group as groupTable, card as cardTable } from "@/db/drizzle/schema";
import { getOrCreateInvoice } from "@/lib/invoices";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { generateUniqueInviteCode } from "@/lib/invites";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [creditorGroups, debtorGroups] = await Promise.all([
        db.query.group.findMany({
            where: { creditorId: session.user.id },
            with: {
                cards: true,
                userDebtorId: { columns: { id: true, name: true, image: true } },
            },
        }),
        db.query.group.findMany({
            where: { debtorId: session.user.id },
            with: {
                cards: true,
                userDebtorId: { columns: { id: true, name: true, image: true } },
            },
        }),
    ]);

    const allGroups = [...creditorGroups, ...debtorGroups];
    const now = new Date();

    await Promise.all(
        allGroups.flatMap((group) => [
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

    return NextResponse.json({ creditorGroups, debtorGroups });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, payerId, receiverId, closingDay, archived, cards } = body;
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

    const [newGroup] = await db
        .insert(groupTable)
        .values({
            name,
            creditorId: safePayerId,
            debtorId: safeReceiverId,
            closingDay,
            archived: Boolean(archived),
            inviteCode: await generateUniqueInviteCode(),
        })
        .returning();

    // equivalente ao `connect` do Prisma: aponta os cartões para o novo grupo
    if (cardIds.length > 0) {
        await db
            .update(cardTable)
            .set({ groupId: newGroup.id })
            .where(inArray(cardTable.id, cardIds));
    }

    return NextResponse.json(newGroup, { status: 201 });
}