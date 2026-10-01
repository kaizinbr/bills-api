import { del, list, put } from "@vercel/blob";
import { getColor } from "colorthief";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { DEFAULT_COLOR } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const CONTENT_TYPES = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
]);

export async function POST(request: Request): Promise<NextResponse> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type")?.split(";", 1)[0];
    const extension = contentType ? CONTENT_TYPES.get(contentType) : undefined;
    if (!contentType || !extension) {
        return NextResponse.json(
            { error: "Only JPEG, PNG, and WebP images are supported" },
            { status: 415 },
        );
    }

    if (!request.body) {
        return NextResponse.json({ error: "Request body is required" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await request.arrayBuffer());
    if (imageBuffer.byteLength === 0) {
        return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }
    if (imageBuffer.byteLength > MAX_AVATAR_SIZE) {
        return NextResponse.json({ error: "Image must be smaller than 5 MB" }, { status: 413 });
    }

    try {
        const userId = session.user.id;
        const prefix = `avatars/${userId}/`;

        // se a cor falhar, não derruba o upload
        const dominantColor = await getColor(imageBuffer, { quality: 10 }).catch(() => null);
        let color = DEFAULT_COLOR;
        try {
            const dominantColor = await getColor(imageBuffer, { quality: 10 });
            color = dominantColor?.hex() ?? DEFAULT_COLOR;
        } catch (error) {
            console.error("Invalid image:", error);
            return NextResponse.json(
                { error: "Invalid image file" },
                { status: 422 },
            );
        }

        const blob = await put(`${prefix}${crypto.randomUUID()}.${extension}`, imageBuffer, {
            access: "public",
            contentType,
            addRandomSuffix: false,
        });

        // limpa uploads pendentes antigos (nunca salvos).
        // Mantém só: a foto atual do banco + a que acabou de subir.
        try {
            const current = await prisma.user.findUnique({
                where: { id: userId },
                select: { image: true },
            });
            const { blobs } = await list({ prefix });
            const stale = blobs
                .map((b) => b.url)
                .filter((url) => url !== blob.url && url !== current?.image);
            if (stale.length) await del(stale);
        } catch (error) {
            console.error("Error cleaning pending avatars:", error);
        }

        return NextResponse.json({ image: blob.url, color });
    } catch (error) {
        console.error("Error uploading avatar:", error);
        return NextResponse.json({ error: "Could not process profile image" }, { status: 500 });
    }
}