// app/api/parcelado/[id]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { purchase as purchaseTable } from "@/db/drizzle/schema";
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

    const purchase = await db.query.purchase.findFirst({
        where: { id },
        with: {
            category: true,
            card: true,
            subscription: true,
            invoice: {
                with: {
                    group: true,
                },
            },
        },
    });

    if (!purchase) {
        return NextResponse.json(
            { error: "Purchase not found" },
            { status: 404 },
        );
    }
    return NextResponse.json({ purchase });
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

    const [deletePurchase] = await db
        .delete(purchaseTable)
        .where(eq(purchaseTable.id, id))
        .returning();

    if (!deletePurchase) {
        return NextResponse.json(
            { error: "Purchase not found" },
            { status: 404 },
        );
    }

    return NextResponse.json({ purchase: deletePurchase });
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
    const { description, amount, cardId, categoryId } = body;

    if (!categoryId || typeof categoryId !== "string") {
        console.log("categoryId is required");
        return NextResponse.json(
            { error: "categoryId is required" },
            { status: 400 },
        );
    }

    const normalizedAmount = parseAmountInCents(amount);
    if (normalizedAmount === null) {
        console.log("amount must contain only digits in cents");
        return NextResponse.json(
            { error: "amount must contain only digits in cents" },
            { status: 400 },
        );
    }

    const [updatedPurchase] = await db
        .update(purchaseTable)
        .set({
            description: description ?? null,
            amount: amount,
            cardId,
            categoryId,
        })
        .where(eq(purchaseTable.id, id))
        .returning();

    if (!updatedPurchase) {
        return NextResponse.json(
            { error: "Purchase not found" },
            { status: 404 },
        );
    }

    return NextResponse.json(updatedPurchase, { status: 200 });
}