import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateInvoice } from "@/lib/invoices";

import { auth } from "@/auth";
import { headers } from "next/headers";

function parseAmountInCents(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;

    const rawValue = String(value).trim();
    if (!/^\d+$/.test(rawValue)) return null;

    const cents = rawValue.padStart(3, "0");
    return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
        id,
        description,
        amount,
        purchasedDate,
        cardId,
        invoiceId,
        groupId,
        categoryId,
    } = body;

    if (!categoryId || typeof categoryId !== "string") {
        return NextResponse.json(
            { error: "categoryId is required" },
            { status: 400 },
        );
    }

    if (!groupId || typeof groupId !== "string") {
        return NextResponse.json(
            { error: "groupId is required" },
            { status: 400 },
        );
    }

    if (!invoiceId || typeof invoiceId !== "string") {
        return NextResponse.json(
            { error: "invoiceId is required" },
            { status: 400 },
        );
    }

    const normalizedAmount = parseAmountInCents(amount);
    if (normalizedAmount === null) {
        return NextResponse.json(
            { error: "amount must contain only digits in cents" },
            { status: 400 },
        );
    }

    const purchasedAt = purchasedDate ? new Date(purchasedDate) : new Date();
    const safeCardId =
        typeof cardId === "string" && cardId.trim() ? cardId : null;

    // resolve (ou cria) a fatura correspondente ao cartão/grupo + data da compra
    const invoice = await getOrCreateInvoice({
        groupId,
        cardId: safeCardId,
        targetDate: purchasedAt,
    });

    const baseData = {
        description: description ?? null,
        amount: normalizedAmount,
        purchasedAt,
        cardId: safeCardId,
        invoiceId: invoice.id,
        categoryId,
        // groupId,
    };

    const purchase =
        typeof id === "string" && id.trim()
            ? await prisma.purchase.update({ where: { id }, data: baseData })
            : await prisma.purchase.create({
                  data: { ...baseData, createdById: session.user.id },
              });

    return NextResponse.json(purchase, { status: 201 });
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

