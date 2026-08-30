import { NextResponse, NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    _request: NextRequest,
    {
        params,
    }: {
        params: Promise<{ id: string }>;
    }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "ID is required" },
            { status: 400 }
        );
    }

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const purchases = await prisma.purchase.findMany({
        where: {
            groupId: id,
        },
    });

    const total = purchases.reduce((sum, purchase) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawPurchase = purchase as any;
        const value = Number(
            rawPurchase.amount ?? rawPurchase.total ?? rawPurchase.value ?? 0
        );

        return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    return NextResponse.json({
        total,
    });
}