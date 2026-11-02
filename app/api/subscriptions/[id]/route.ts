// app/api/subscriptions/[id]/route.ts — cancelar (nunca deleta, só marca canceledAt)
import { NextResponse, NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/index";
import {
    purchase as purchaseTable,
    subscription as subscriptionTable,
} from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await db.query.subscription.findFirst({
        where: { id },
        with: { category: true, card: true, userUserId: true },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ subscription: subscription ?? null });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [subscription] = await db
        .select()
        .from(subscriptionTable)
        .where(eq(subscriptionTable.id, id))
        .limit(1);

    if (!subscription) {
        return NextResponse.json(
            { error: "Subscription not found" },
            { status: 404 },
        );
    }

    await db
        .delete(purchaseTable)
        .where(
            and(
                eq(purchaseTable.subscriptionId, id),
                gt(purchaseTable.purchasedAt, subscription.canceledAt ?? new Date()),
            ),
        );

    const [deleteSubscription] = await db
        .delete(subscriptionTable)
        .where(eq(subscriptionTable.id, id))
        .returning();

    return NextResponse.json({ purchase: deleteSubscription });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, amount, cardId, categoryId, userId } = body;

    if (!categoryId || typeof categoryId !== "string") {
        console.log("categoryId is required");
        return NextResponse.json(
            { error: "categoryId is required" },
            { status: 400 },
        );
    }

    const [updatedSubscription] = await db
        .update(subscriptionTable)
        .set({
            name: name ?? null,
            amount,
            cardId,
            categoryId,
            userId: userId ?? null,
        })
        .where(eq(subscriptionTable.id, id))
        .returning();

    if (!updatedSubscription) {
        return NextResponse.json(
            { error: "Subscription not found" },
            { status: 404 },
        );
    }

    await db
        .update(purchaseTable)
        .set({
            description: name ?? null,
            amount,
            cardId,
            categoryId,
        })
        .where(eq(purchaseTable.subscriptionId, id));

    return NextResponse.json(updatedSubscription, { status: 200 });
}