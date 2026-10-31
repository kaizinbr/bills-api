import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { card as cardTable } from "@/db/drizzle/schema";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const myCards = await db
        .select()
        .from(cardTable)
        .where(eq(cardTable.ownerId, session.user.id));

    return NextResponse.json({ myCards });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, ownerId, groupId, digits } = body;

    if (!name || typeof name !== "string") {
        return NextResponse.json(
            { error: "Card name is required" },
            { status: 400 },
        );
    }

    if (!color || typeof color !== "string") {
        return NextResponse.json(
            { error: "Card color is required" },
            { status: 400 },
        );
    }

    const finalColor = color.startsWith("#") ? color : `#${color}`;

    const [newCard] = await db
        .insert(cardTable)
        .values({
            name,
            color: finalColor,
            ownerId: ownerId || session.user.id,
            createdById: session.user.id,
            groupId: groupId || null,
            digits: digits || "0000",
        })
        .returning();

    return NextResponse.json(newCard, { status: 201 });
}