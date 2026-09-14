import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { parseAmountInCents } from "@/app/api/purchases/[id]/route";

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

    const group = await prisma.group.findFirst({
        where: {
            id: id,
        },
        include: {
            cards: true, // Include the related cards
            subscriptions: true, // Include the related subscriptions
            debtor: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    });

    return NextResponse.json({ group });
}

export async function DELETE(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    },
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

    const group = await prisma.group.findFirst({
        where: {
            id: id,
        },
    });

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    await prisma.group.delete({
        where: {
            id: id,
        },
    });

    return NextResponse.json({ message: "Group deleted successfully" });
}


export async function PATCH(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    },
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

    const group = await prisma.group.findFirst({
        where: {
            id: id,
        },
    });

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }


    const { name, limit, closingDay } = await request.json();

    const parsedLimit = parseAmountInCents(limit);

    if (!name || !parsedLimit || !closingDay) {
        return NextResponse.json(
            { error: "Name, limit, and closing day are required" },
            { status: 400 },
        );
    }

    const updatedGroup = await prisma.group.update({
        where: {
            id: id,
        },
        data: {
            name,
            limit: parsedLimit,
            closingDay,
        },
    });

    return NextResponse.json({ group: updatedGroup });
}