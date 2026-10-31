import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
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

    const cards = await db.query.card.findMany({
        where: { groupId: id },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ cards });
}