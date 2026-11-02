// app/api/subscriptions/route.ts
import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import {
    card as cardTable,
    subscription as subscriptionTable,
} from "@/db/drizzle/schema";
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

    const { cardId, categoryId, name, amountCents, chargeDay, groupId, userId } =
        await request.json();

        console.log("POST /api/subscriptions", {
            cardId,
            categoryId,
            name,
            amountCents,
            chargeDay,
            groupId,
            userId
        });

    if (!categoryId || !name || !amountCents || !chargeDay) {
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

    const [card] = await db
        .select()
        .from(cardTable)
        .where(eq(cardTable.id, cardId))
        .limit(1);

    const [subscription] = await db
        .insert(subscriptionTable)
        .values({
            cardId,
            categoryId,
            name,
            amount: Number(amountCents),
            chargeDay,
            createdById: session.user.id,
            groupId,
            userId,
        })
        .returning();

    // cobra imediatamente na fatura atual desse cartão, sem esperar o
    // próximo GET /groups ou a virada de período
    const currentInvoice = await getOrCreateInvoice({
        groupId: groupId,
        targetDate: new Date(),
    });
    console.log("currentInvoice", currentInvoice);
    await chargeSubscriptionsForInvoice({invoice: currentInvoice});

    return NextResponse.json({ subscription });
}