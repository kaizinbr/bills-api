import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db/index";
import { installmentPlan as installmentPlanTable } from "@/db/drizzle/schema";
import { generateInstallmentPurchases } from "@/lib/installments";

import { auth } from "@/auth";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
        id,
        description,
        totalAmount,
        installments,
        dayOfMonth,
        startDate,
        cardId,
        groupId,
        categoryId,
        userId,
    } = body;

    if (!categoryId || typeof categoryId !== "string") {
        return NextResponse.json(
            { error: "categoryId is required" },
            { status: 400 },
        );
    }

    if (!groupId || typeof groupId !== "string") {
        return NextResponse.json(
            { error: "groupId is required" },
            { status: 400 },
        );
    }

    if (!totalAmount || typeof totalAmount !== "number") {
        return NextResponse.json(
            { error: "totalAmount is required" },
            { status: 400 },
        );
    }

    if (!installments || typeof installments !== "number") {
        return NextResponse.json(
            { error: "installments is required" },
            { status: 400 },
        );
    }

    if (!dayOfMonth || typeof dayOfMonth !== "number") {
        return NextResponse.json(
            { error: "dayOfMonth is required" },
            { status: 400 },
        );
    }

    if (!startDate || typeof startDate !== "string") {
        return NextResponse.json(
            { error: "startDate is required" },
            { status: 400 },
        );
    }


    const [newInstallment] = await db
        .insert(installmentPlanTable)
        .values({
            userId: userId,
            description: description,
            categoryId: categoryId,
            cardId: cardId,
            createdById: session.user.id,
            totalAmount: totalAmount,
            installments: installments,
            dayOfMonth: dayOfMonth,
            startDate: new Date(startDate),
            groupId: groupId,
        })
        .returning();
    console.log(newInstallment)


    const plan = {
        id: newInstallment.id,
        description,
        totalAmount,
        installments,
        dayOfMonth,
        startDate: new Date(startDate),
        cardId,
        groupId,
        categoryId,
        userId,
        createdById: session.user.id,
    };
    console.log("plan", plan);

    // resolve (ou cria) a fatura correspondente ao cartão/grupo + data da compra
    const installment = await generateInstallmentPurchases(plan);

    return NextResponse.json( { status: 201 });
}

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installments = await db.query.installmentPlan.findMany({
        with: {
            category: true,
            card: true,
            purchases: {
                orderBy: { purchasedAt: "asc" },
            },
        },
    });

    if (!installments) {
        return NextResponse.json(
            { error: "installments not found" },
            { status: 404 },
        );
    }

    return NextResponse.json({ installments });
}