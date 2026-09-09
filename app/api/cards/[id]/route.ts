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

    const card = await prisma.card.findUnique({
        where: { id },
    });

    if (!card) {
        return NextResponse.json(
            { error: "Card not found" },
            { status: 404 },
        );
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
    const card = await prisma.card.findUnique({
        where: { id },
    });

    if (!card) {
        return NextResponse.json(
            { error: "Card not found" },
            { status: 404 },
        );
    }

    // update purchase to nullify cardId instead of deleting it
    await prisma.purchase.updateMany({
        where: { cardId: id },
        data: { cardId: null },
    });

    const deletePurchase = await prisma.card.delete({
        where: { id },
    });
    
    return NextResponse.json({ card: deletePurchase });
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

    const updatedCard = await prisma.card.update({
        where: { id },
        data: {
            name,
            digits,
            color,
        },
    });

    return NextResponse.json(updatedCard, { status: 200 });
}
