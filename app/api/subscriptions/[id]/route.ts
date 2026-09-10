// app/api/subscriptions/[id]/route.ts — cancelar (nunca deleta, só marca canceledAt)
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { parseAmountInCents } from "@/app/api/purchases/[id]/route";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await prisma.subscription.findFirst({
        where: { id },
        include: { category: true, card: true },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscription });
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

    const subscription = await prisma.subscription.findUnique({
        where: { id },
    });

    if (!subscription) {
        return NextResponse.json(
            { error: "Subscription not found" },
            { status: 404 },
        );
    }

    const deletePurchase = await prisma.subscription.delete({
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
    const { name, amount, cardId, categoryId } = body;

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

    const updatedPurchase = await prisma.subscription.update({
        where: { id },
        data: {
            name: name ?? null,
            amount: normalizedAmount,
            cardId,
            categoryId,
        },
    });

    return NextResponse.json(updatedPurchase, { status: 200 });
}
