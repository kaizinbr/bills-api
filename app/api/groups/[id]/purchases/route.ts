import { NextResponse, NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import {
    purchase as purchaseTable,
    invoice as invoiceTable,
} from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

const PAGE_SIZE = 20;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const page = Math.max(
        Number(request.nextUrl.searchParams.get("page")) || 1,
        1,
    );

    const [purchases, [{ total }]] = await Promise.all([
        db.query.purchase.findMany({
            where: { invoice: { groupId: id } },
            orderBy: { purchasedAt: "desc" },
            offset: (page - 1) * PAGE_SIZE,
            limit: PAGE_SIZE,
            with: {
                category: {
                    columns: { id: true, key: true, label: true, icon: true },
                },
                card: { columns: { id: true, name: true, color: true } },
                installmentPlan: {
                    columns: {
                        id: true, description: true, totalAmount: true, dayOfMonth: true,
                    },
                },
            },
        }),
        db
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(purchaseTable)
            .innerJoin(invoiceTable, eq(invoiceTable.id, purchaseTable.invoiceId))
            .where(eq(invoiceTable.groupId, id)),
    ]);

    return NextResponse.json({
        purchases,
        pagination: {
            total,
            page,
            pageSize: PAGE_SIZE,
            hasNextPage: page * PAGE_SIZE < total,
        },
    });
}