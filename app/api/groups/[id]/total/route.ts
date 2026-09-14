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

    // soma todas as compras de todas as invoices do grupo (todos os cartões
    // + o balde avulso), já que Purchase não tem mais id direto
    const result = await prisma.purchase.aggregate({
        where: { invoice: { groupId: id } },
        _sum: { amount: true },
    });

    return NextResponse.json({ total: result._sum.amount ?? 0 });
}
