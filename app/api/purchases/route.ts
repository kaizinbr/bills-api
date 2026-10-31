import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { purchase as purchaseTable } from "@/db/drizzle/schema";
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
        userId,
    };

    const isUpdate = Boolean(typeof id === "string" && id.trim());

    const [purchase] = isUpdate
        ? await db
              .update(purchaseTable)
              .set(baseData)
              .where(eq(purchaseTable.id, id))
              .returning()
        : await db
              .insert(purchaseTable)
              .values({ ...baseData, createdById: session.user.id })
              .returning();

    if (!purchase) {
        return NextResponse.json(
            { error: "Purchase not found" },
            { status: 404 },
        );
    }

    return NextResponse.json(purchase, { status: 201 });
}

export async function GET(
    request: NextRequest,
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchase = await db.query.purchase.findMany({
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