import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";

import { chargeSubscriptionsForInvoice } from "@/lib/invoices";

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

    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const page = Math.max(Number(pageParam) || 1, 1);
    const limit = 30;
    const skip = (page - 1) * limit;


    const invoice = await prisma.invoice.findFirst({
        where: {
            id: id,
        },
        include: {
            purchases: true,
        },
    });

    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await chargeSubscriptionsForInvoice({ invoice });
    console.log("invoice", invoice?.groupId);

    // const activeSubscriptions = await prisma.subscription.findMany({
    //     where: {
    //         groupId: invoice?.groupId,
    //         canceledAt: null,
    //     },
    // });

    // console.log("activeSubscriptions", activeSubscriptions);

    // // check and update purchases for active subscriptions
    // for (const subscription of activeSubscriptions) {
    //     const existingPurchase = await prisma.purchase.findFirst({
    //         where: {
    //             subscriptionId: subscription.id,
    //             invoiceId: id,
    //         },
    //     });

    //     if (!existingPurchase) {
    //         // Create a new purchase for this subscription
    //         await prisma.purchase.create({
    //             data: {
    //                 description: subscription.name,
    //                 amount: subscription.amount,
    //                 purchasedAt: new Date(),
    //                 invoiceId: id,
    //                 subscriptionId: subscription.id,
    //                 categoryId: subscription.categoryId,
    //                 cardId: subscription.cardId,
    //                 createdById: session.user.id,
    //             },
    //         });
    //     }
    // }

    // const updatedInvoice = await prisma.invoice.findFirst({
    //     where: {
    //         id: id,
    //     },
    //     include: {
    //         purchases: true,
    //     },
    // });

    const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
            where: { invoiceId: id },
            skip,
            take: limit,
            orderBy: { purchasedAt: "desc" },
            include: {
                category: true,
                subscription: true,
                installmentPlan: true,
            },
        }),
        prisma.purchase.count({ where: { invoiceId: id } }),
    ]);

    return NextResponse.json({
        purchases,
        pagination: {
            total,
            page,
            pageSize: limit,
            hasNextPage: page * limit < total,
        },
    });
}
