// app/api/subscriptions/route.ts
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";
import {
    getOrCreateInvoice,
    chargeSubscriptionsForInvoice,
} from "@/lib/invoices";

function parseAmountInCents(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;

    const rawValue = String(value).trim();
    if (!/^\d+$/.test(rawValue)) return null;

    const cents = rawValue.padStart(3, "0");
    return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cardId, categoryId, name, amountCents, chargeDay, groupId } =
        await request.json();

    if (!cardId || !categoryId || !name || !amountCents || !chargeDay) {
        return NextResponse.json(
            { error: "Campos obrigatórios faltando" },
            { status: 400 },
        );
    }

    if (chargeDay < 1 || chargeDay > 28) {
        return NextResponse.json(
            { error: "Dia de cobrança inválido" },
            { status: 400 },
        );
    }

    const normalizedAmount = parseAmountInCents(amountCents);
    if (normalizedAmount === null) {
        return NextResponse.json(
            { error: "amount must contain only digits in cents" },
            { status: 400 },
        );
    }

    const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } });

    const subscription = await prisma.subscription.create({
        data: {
            cardId,
            categoryId,
            name,
            amount: normalizedAmount,
            chargeDay,
            createdById: session.user.id,
            groupId,
        },
    });

    // cobra imediatamente na fatura atual desse cartão, sem esperar o
    // próximo GET /groups ou a virada de período
    const currentInvoice = await getOrCreateInvoice({
        groupId: card.groupId,
        cardId,
        targetDate: new Date(),
    });
    console.log("currentInvoice", currentInvoice);
    await chargeSubscriptionsForInvoice({invoice: currentInvoice, cardId});

    return NextResponse.json({ subscription });
}
