import { NextResponse, NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { group as groupTable } from "@/db/drizzle/schema";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { parseAmountInCents } from "@/app/api/purchases/[id]/route";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Group ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await db.query.group.findFirst({
        where: { id },
        with: {
            cards: true,
            subscriptions: true,
            userDebtorId: {
                columns: { id: true, name: true, image: true },
            },
            groupMembers: {
                with: {
                    user: {
                        columns: { id: true, name: true, image: true },
                    },
                },
            },
        },
    });

    return NextResponse.json({ group });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Group ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [deleted] = await db
        .delete(groupTable)
        .where(eq(groupTable.id, id))
        .returning({ id: groupTable.id });

    if (!deleted) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Group deleted successfully" });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Group ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, limit, closingDay } = await request.json();

    const parsedLimit = parseAmountInCents(limit);

    if (!name || !parsedLimit || !closingDay) {
        return NextResponse.json(
            { error: "Name, limit, and closing day are required" },
            { status: 400 },
        );
    }

    const [updatedGroup] = await db
        .update(groupTable)
        .set({
            name,
            limit,
            closingDay,
        })
        .where(eq(groupTable.id, id))
        .returning();

    if (!updatedGroup) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ group: updatedGroup });
}