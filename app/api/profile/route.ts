import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse, NextRequest } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db/index";
import { user as userTable } from "@/db/drizzle/schema";
import { HEX_COLOR, isUserAvatarUrl, isVercelBlobUrl } from "@/lib/avatar";


export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1);

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
        let previous: string | null = null;
        if (data.image) {
            const [current] = await db
                .select({ image: userTable.image })
                .from(userTable)
                .where(eq(userTable.id, userId))
                .limit(1);
            previous = current?.image ?? null;
        }

        const [user] = await db
            .update(userTable)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(userTable.id, userId))
            .returning({
                id: userTable.id,
                name: userTable.name,
                image: userTable.image,
                color: userTable.color,
            });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

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