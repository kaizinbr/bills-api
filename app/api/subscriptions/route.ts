// app/api/subscriptions/route.ts
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cardId, categoryId, name, amount, chargeDay } = await request.json();

    if (!cardId || !categoryId || !name || !amount || !chargeDay) {
        return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const subscription = await prisma.subscription.create({
        data: {
            cardId,
            categoryId,
            name,
            amount,
            chargeDay,
            createdById: session.user.id,
        },
    });

    return NextResponse.json({ subscription });
}