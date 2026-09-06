import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const invoices = await prisma.invoice.findMany({
        where: { groupId: id },
        include: { card: { select: { id: true, name: true, color: true } } },
        orderBy: { periodStart: "desc" },
    });

    return NextResponse.json({ invoices });
}
