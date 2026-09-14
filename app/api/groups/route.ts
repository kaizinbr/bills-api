import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateInvoice } from "@/lib/invoices";
import { generateUniqueInviteCode } from "@/lib/invites";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { parseAmountInCents } from "@/app/api/purchases/route";

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.group.findMany({
        where: {
            members: {
                some: {
                    userId: session.user.id,
                },
            },
        },
        include: {
            cards: true,
            debtor: { select: { id: true, name: true, image: true } },
            invoices: { orderBy: { periodStart: "desc" }, take: 1 },
            _count: {
                select: {
                    subscriptions: true
                },
            },
            members: true
        },
    });

    console.log("Groups fetched for user:", session.user.id, groups);

    // garante que a fatura do período atual existe pra cada cartão (e pro
    // balde avulso de cada grupo), o que também dispara a geração das
    // cobranças de assinatura desse período
    const now = new Date();

    await Promise.all(
        groups.flatMap((group) => [
            getOrCreateInvoice({
                groupId: group.id,
                cardId: null,
                targetDate: now,
            }),
            ...group.cards.map((card) =>
                getOrCreateInvoice({
                    groupId: group.id,
                    cardId: card.id,
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
    const cardIds = Array.isArray(cards) ? cards : [];

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
    const normalizedAmount = parseAmountInCents(amount);
        if (normalizedAmount === null) {
            return NextResponse.json(
                { error: "amount must contain only digits in cents" },
                { status: 400 },
            );
        }

    const newGroup = await prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
            data: {
                name,
                limit: normalizedAmount,
                creditorId: safePayerId,
                debtorId: safeReceiverId,
                closingDay,
                inviteCode,
                archived: Boolean(archived),
                ...(cardIds.length > 0 && {
                    cards: {
                        connect: cardIds.map((cardId: string) => ({ id: cardId })),
                    },
                }),
            },
        });

        // quem criou a conta vira membro com acesso total (owner)
        await tx.groupMember.create({
            data: {
                groupId: group.id,
                userId: session.user.id,
                role: "OWNER",
            },
        });

        return group;
    });

    await getOrCreateInvoice({
        groupId: newGroup.id,
        cardId: null,
        targetDate: new Date(),
    });

    return NextResponse.json(newGroup, { status: 201 });
}