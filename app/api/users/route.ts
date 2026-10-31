import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
import { user as userTable } from "@/db/drizzle/schema";

import { auth } from "@/auth"
import { headers } from "next/headers"


export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await db
        .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            image: userTable.image,
            color: userTable.color,
            createdAt: userTable.createdAt,
            updatedAt: userTable.updatedAt,
        })
        .from(userTable);

    return NextResponse.json({ users });
}