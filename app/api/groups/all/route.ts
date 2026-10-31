import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await db.query.group.findMany({
        where: {
            OR: [
                { debtorId: session.user.id },
                { creditorId: session.user.id },
            ],
        },
        with: {
            cards: true,
            userDebtorId: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    });

    return NextResponse.json({ groups });
}