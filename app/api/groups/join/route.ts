import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateInvoice } from "@/lib/invoices";
import { generateUniqueInviteCode } from "@/lib/invites";

import { auth } from "@/auth";
import { headers } from "next/headers";
import { parseAmountInCents } from "@/app/api/purchases/route";

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json(
            { error: "Invite code is required" },
            { status: 400 },
        );
    }

    const group = await prisma.group.findUnique({
        where: { inviteCode },
        include: { members: true },
    });

    if (!group) {
        return NextResponse.json(
            { error: "Group not found with the provided invite code" },
            { status: 404 },
        );
    }

    if (group.members.some((member) => member.userId === session.user.id)) {
        return NextResponse.json(
            { error: "Você já é membro desta conta" },
            { status: 400 },
        );
    }

    const newMember = await prisma.group.update({
        where: { inviteCode },
        data: {
            members: {
                create: {
                    userId: session.user.id,
                    role: "MEMBER",
                },
            },
        },
    });

    return NextResponse.json(newMember, { status: 201 });
}