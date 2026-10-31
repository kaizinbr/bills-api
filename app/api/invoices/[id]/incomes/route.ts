import { NextResponse, NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { incomeEntry as incomeTable } from "@/db/drizzle/schema";
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const incomes = await db
        .select()
        .from(incomeTable)
        .where(eq(incomeTable.invoiceId, id))
        .orderBy(desc(incomeTable.createdAt));

    const total = incomes.reduce((acc, income) => acc + income.amount, 0);

    return NextResponse.json({ incomes, total });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { error: "Group ID is required" },
            { status: 400 },
        );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { description, amount } = body;

    if (!description || typeof description !== "string") {
        return NextResponse.json(
            { error: "Description is required" },
            { status: 400 },
        );
    }

    if (!amount || typeof amount !== "number") {
        return NextResponse.json(
            { error: "Amount is required" },
            { status: 400 },
        );
    }

    const [newIncome] = await db
        .insert(incomeTable)
        .values({
            description,
            amount,
            invoiceId: id,
            createdById: session.user.id,
        })
        .returning();

    return NextResponse.json({ income: newIncome });
}