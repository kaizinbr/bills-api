import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
import { groupMember as groupMemberTable } from "@/db/drizzle/schema";

import { auth } from "@/auth";
import { headers } from "next/headers";

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

    const group = await db.query.group.findFirst({
        where: { inviteCode: inviteCode.toUpperCase() },
        with: { groupMembers: true },
    });

    if (!group) {
        return NextResponse.json(
            { error: "Group not found with the provided invite code" },
            { status: 404 },
        );
    }

    if (group.groupMembers.some((member) => member.userId === session.user.id)) {
        return NextResponse.json(
            { error: "Você já é membro desta conta" },
            { status: 400 },
        );
    }

    await db.insert(groupMemberTable).values({
        groupId: group.id,
        userId: session.user.id,
        role: "MEMBER",
    });

    return NextResponse.json(group, { status: 201 });
}