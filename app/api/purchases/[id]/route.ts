// app/api/subscriptions/[id]/route.ts — cancelar (nunca deleta, só marca canceledAt)
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

function parseAmountInCents(value: unknown): string | null {
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

    const purchase = await prisma.purchase.findUnique({
        where: { id },
        include: {
            category: true,
            card: true,
            subscription: true,
            invoice: {
                include: {
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

    const purchase = await prisma.purchase.findUnique({
        where: { id },
    });

    if (!purchase) {
        return NextResponse.json(
            { error: "Purchase not found" },
            { status: 404 },
        );
    }

    const deletePurchase = await prisma.purchase.delete({
        where: { id },
    });
    
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

    const updatedPurchase = await prisma.purchase.update({
        where: { id },
        data: {
            description: description ?? null,
            amount: normalizedAmount,
            cardId,
            categoryId,
        },
    });

    return NextResponse.json(updatedPurchase, { status: 200 });
}
