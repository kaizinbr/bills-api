import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const group = await prisma.group.findFirst({
        where: {
            invoices: {
                some: {
                    id: id,
                },
            },
        },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });

    if (!group) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const purchases = await prisma.purchase.findMany({
        where: {
            invoiceId: id,
        },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
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
        user: purchase.user,
    }));

    const unassignedPurchases = purchasesWithUser.filter(
        (purchase) => purchase.userId === null,
    );
    const unassignedTotal = unassignedPurchases.reduce(
        (total, purchase) => total + purchase.amount,
        0,
    );
    const sharedAmount = group.members.length
        ? Math.floor(unassignedTotal / group.members.length)
        : 0;

    const members = group.members.map((member) => {
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
