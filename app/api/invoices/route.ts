import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateInvoice } from "@/lib/invoices";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const creditorGroups = await prisma.group.findMany({
        where: { creditorId: session.user.id },
        include: {
            cards: true,
            debtor: { select: { id: true, name: true, image: true } },
        },
    });

    const debtorGroups = await prisma.group.findMany({
        where: { debtorId: session.user.id },
        include: {
            cards: true,
            debtor: { select: { id: true, name: true, image: true } },
        },
    });

    // garante que a fatura do período atual existe pra cada cartão (e pro
    // balde avulso de cada grupo), o que também dispara a geração das
    // cobranças de assinatura desse período
    const allGroups = [...creditorGroups, ...debtorGroups];
    const now = new Date();

    await Promise.all(
        allGroups.flatMap((group) => [
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

    const newGroup = await prisma.group.create({
        data: {
            name,
            creditorId: safePayerId,
            debtorId: safeReceiverId,
            closingDay,
            archived: Boolean(archived),
            ...(cardIds.length > 0 && {
                cards: {
                    connect: cardIds.map((cardId: string) => ({ id: cardId })),
                },
            }),
        },
    });

    return NextResponse.json(newGroup, { status: 201 });
}
