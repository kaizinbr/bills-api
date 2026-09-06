import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const page = Math.max(Number(pageParam) || 1, 1);
    const limit = 30;
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
            where: { invoiceId: id },
            skip,
            take: limit,
            orderBy: { purchasedAt: "desc" },
            include: { category: true },
        }),
        prisma.purchase.count({ where: { invoiceId: id } }),
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