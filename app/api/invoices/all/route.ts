import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.group.findMany({
        where: {
            OR: [
                {
                    debtorId: session.user.id,
                },
                {
                    creditorId: session.user.id,
                },
            ],
        },
        include: {
            cards: true, // Include the related cards
            debtor: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    });

    return NextResponse.json({ groups });
}