import { NextResponse, NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { groupMember as groupMemberTable } from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // remove o usuário do grupo
    await db
        .delete(groupMemberTable)
        .where(
            and(
                eq(groupMemberTable.groupId, id),
                eq(groupMemberTable.userId, session.user.id),
            ),
        );

    return NextResponse.json({ message: "User signed out from group" });
}