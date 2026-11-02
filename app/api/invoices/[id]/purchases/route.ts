import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { purchase as purchaseTable } from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

import { chargeSubscriptionsForInvoice } from "@/lib/invoices";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Invoice ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = Math.max(Number(pageParam) || 1, 1);
    const limit = pageSizeParam === "all" ? 9999999 : Math.max(Number(pageSizeParam) || 30, 1);
    const offset = (page - 1) * limit;

    const invoice = await db.query.invoice.findFirst({
        where: { id },
        with: { purchases: true },
    });

    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await chargeSubscriptionsForInvoice({ invoice });

    const [purchases, total] = await Promise.all([
        db.query.purchase.findMany({
            where: { invoiceId: id },
            limit,
            offset,
            orderBy: { purchasedAt: "desc" },
            with: {
                category: true,
                subscription: true,
                installmentPlan: true,
            },
        }),
        db.$count(purchaseTable, eq(purchaseTable.invoiceId, id)),
    ]);

    return NextResponse.json({
        purchases,
        pagination: {
            total,
            page,
            pageSize: limit,
            hasNextPage: page * limit < total,
        },
    });
}