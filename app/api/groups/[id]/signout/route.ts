import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

    // remove usuario from group
    await prisma.groupMember.deleteMany({
        where: {
            groupId: id,
            userId: session.user.id,
        },
    });

    return NextResponse.json({ message: "User signed out from group" });
}
