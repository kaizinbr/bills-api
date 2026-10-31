import { NextResponse, NextRequest } from "next/server";

import { auth } from "@/auth";
import { headers } from "next/headers";


import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { group as groupTable, card as cardTable, purchase as puschaseTable } from "@/db/drizzle/schema";

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

    const invoice = await db.query.invoice.findFirst({
        where: {
            id: id,
        },
        with: {
            purchases: true, 
        },
    });

    console.log("invoice", invoice?.groupId);

    return NextResponse.json({ invoice });
}
