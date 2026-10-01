import { del } from "@vercel/blob";
import { headers } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

import { auth } from "@/auth";
import { HEX_COLOR, isUserAvatarUrl, isVercelBlobUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";


export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: {
            id: session.user.id,
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
}

export async function PATCH(request: Request): Promise<NextResponse> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const data: { name?: string; image?: string; color?: string } = {};

    if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 20) {
            return NextResponse.json({ error: "Invalid name" }, { status: 400 });
        }
        data.name = name;
    }

    // image e color andam juntos
    if (body.image !== undefined || body.color !== undefined) {
        if (
            typeof body.image !== "string" ||
            typeof body.color !== "string" ||
            !HEX_COLOR.test(body.color) ||
            !isUserAvatarUrl(body.image, userId)
        ) {
            return NextResponse.json({ error: "Invalid image or color" }, { status: 400 });
        }
        data.image = body.image;
        data.color = body.color;
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    try {
        const previous = data.image
            ? (await prisma.user.findUnique({ where: { id: userId }, select: { image: true } }))?.image
            : null;

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, name: true, image: true, color: true },
        });

        if (previous && previous !== data.image && isVercelBlobUrl(previous)) {
            try {
                await del(previous);
            } catch (error) {
                console.error("Error deleting previous avatar blob:", error);
            }
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }
}