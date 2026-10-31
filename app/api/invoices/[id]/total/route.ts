import { NextResponse, NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { purchase as purchaseTable } from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

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

    const [result] = await db
        .select({
            total: sql<number>`coalesce(sum(${purchaseTable.amount}), 0)`.mapWith(Number),
        })
        .from(purchaseTable)
        .where(eq(purchaseTable.invoiceId, id));

    return NextResponse.json({ total: result.total });
}