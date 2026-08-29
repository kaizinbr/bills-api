import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

import { auth } from "@/auth"
import { headers } from "next/headers"


export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const myCards = await prisma.card.findMany({
        where: {
            ownerId: session.user.id,
        },
    });


    return NextResponse.json({ myCards });
}


export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, ownerId, groupId } = body;

    if (!name || typeof name !== "string") {
        return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const newCard = await prisma.card.create({
        data: {
            name,
            color,
            ownerId: ownerId || session.user.id,
            createdById: session.user.id,
            groupId: groupId || null,
        },
    });

    return NextResponse.json(newCard, { status: 201 });
}