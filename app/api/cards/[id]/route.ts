import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import {
    card as cardTable,
    purchase as purchaseTable,
} from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

export function parseAmountInCents(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;

    const rawValue = String(value).trim();
    if (!/^\d+$/.test(rawValue)) return null;

    const cents = rawValue.padStart(3, "0");
    return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [card] = await db
        .select()
        .from(cardTable)
        .where(eq(cardTable.id, id))
        .limit(1);

    if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({ card });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedCard = await db.transaction(async (tx) => {
        // desvincula as compras em vez de apagá-las
        await tx
            .update(purchaseTable)
            .set({ cardId: null })
            .where(eq(purchaseTable.cardId, id));

        const [deleted] = await tx
            .delete(cardTable)
            .where(eq(cardTable.id, id))
            .returning();

        return deleted;
    });

    if (!deletedCard) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({ card: deletedCard });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, digits, color } = body;

    const [updatedCard] = await db
        .update(cardTable)
        .set({ name, digits, color })
        .where(eq(cardTable.id, id))
        .returning();

    if (!updatedCard) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json(updatedCard, { status: 200 });
}