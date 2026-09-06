import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

const PAGE_SIZE = 20;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ groupId: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

    // compras não têm mais groupId direto — filtra pelas invoices do grupo
    const where = { invoice: { groupId } };

    const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
            where,
            orderBy: { purchasedAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: {
                category: {
                    select: { id: true, key: true, label: true, icon: true },
                },
                card: { select: { id: true, name: true, color: true } },
            },
        }),
        prisma.purchase.count({ where }),
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
