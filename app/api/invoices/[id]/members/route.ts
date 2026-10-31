import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Invoice ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await db.query.group.findFirst({
        where: {
            invoices: { id },
        },
        with: {
            groupMembers: {
                with: {
                    user: {
                        columns: { id: true, name: true, image: true },
                    },
                },
            },
        },
    });

    if (!group) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const purchases = await db.query.purchase.findMany({
        where: { invoiceId: id },
        with: {
            userUserId: {
                columns: { id: true, name: true, image: true },
            },
        },
    });

    const purchasesWithUser = purchases.map((purchase) => ({
        id: purchase.id,
        invoiceId: purchase.invoiceId,
        userId: purchase.userId,
        amount: purchase.amount,
        description: purchase.description,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
        user: purchase.userUserId,
    }));

    const unassignedPurchases = purchasesWithUser.filter(
        (purchase) => purchase.userId === null,
    );
    const unassignedTotal = unassignedPurchases.reduce(
        (total, purchase) => total + purchase.amount,
        0,
    );
    const sharedAmount = group.groupMembers.length
        ? Math.floor(unassignedTotal / group.groupMembers.length)
        : 0;

    const members = group.groupMembers.map((member) => {
        const memberPurchases = purchasesWithUser.filter(
            (purchase) => purchase.userId === member.userId,
        );
        const total = memberPurchases.reduce(
            (memberTotal, purchase) => memberTotal + purchase.amount,
            0,
        );

        return {
            id: member.id,
            groupId: member.groupId,
            userId: member.userId,
            role: member.role,
            user: member.user,
            purchases: memberPurchases,
            total,
            totalWithShared: total + sharedAmount,
        };
    });

    return NextResponse.json({
        members,
        purchases: purchasesWithUser,
        unassignedPurchases,
        unassignedTotal,
        sharedAmount,
    });
}