import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const group = await db.query.group.findFirst({
        where: { id },
        with: {
            groupMembers: {
                with: {
                    user: { columns: { id: true, name: true, image: true } },
                },
            },
        },
    });

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // mantém a chave `members` na resposta para o app Expo não quebrar
    return NextResponse.json({ members: group.groupMembers });
}