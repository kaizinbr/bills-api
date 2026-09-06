// app/api/groups/[id]/subscriptions/route.ts
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
        where: { groupId: id, canceledAt: null },
        include: { category: true, card: true },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscriptions });
}