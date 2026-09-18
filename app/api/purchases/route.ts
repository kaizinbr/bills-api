import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateInvoice } from "@/lib/invoices";

import { auth } from "@/auth";
import { headers } from "next/headers";


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
        userId,
    } = body;
    console.log(userId)

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

    const purchasedAt = purchasedDate ? new Date(purchasedDate) : new Date();
    const safeCardId =
        typeof cardId === "string" && cardId.trim() ? cardId : null;

    // resolve (ou cria) a fatura correspondente ao cartão/grupo + data da compra
    const invoice = await getOrCreateInvoice({
        groupId,
        targetDate: purchasedAt,
    });

    const baseData = {
        description: description ?? null,
        amount: amount,
        purchasedAt,
        cardId: safeCardId,
        invoiceId: invoice.id,
        categoryId,
        userId
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
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchase = await prisma.purchase.findMany({
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