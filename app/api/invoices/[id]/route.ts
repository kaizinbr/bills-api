import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findFirst({
        where: {
            id: id,
        },
        include: {
            purchases: true, 
        },
    });

    return NextResponse.json({ invoice });
}
