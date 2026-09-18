import { prisma } from "@/lib/prisma";
import type { InstallmentPlan } from "@/lib/generated/prisma/client";
import { getOrCreateInvoice } from "@/lib/invoices";

/**
 * Data da parcela `index` (0-based) a partir da data da 1ª parcela.
 * Meio-dia UTC evita a data virar o dia anterior/seguinte por causa de fuso.
 * Sem clamp de fim de mês: dayOfMonth é sempre 1-28, então cabe em qualquer mês.
 */
function installmentDate(
    startDate: Date,
    dayOfMonth: number,
    index: number,
): Date {
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth() + index;
    return new Date(Date.UTC(year, month, dayOfMonth, 12, 0, 0, 0));
}

/**
 * Divide totalAmount (em centavos) em `installments` parcelas iguais,
 * jogando o resto do arredondamento na 1ª parcela.
 */
function splitInstallments(
    totalAmount: number,
    installments: number,
): number[] {
    const base = Math.floor(totalAmount / installments);
    const remainder = totalAmount - base * installments;

    return Array.from({ length: installments }, (_, index) =>
        index === 0 ? base + remainder : base,
    );
}

/**
 * Gera (de forma idempotente) uma Purchase por parcela do plano, cada uma na
 * fatura do mês correspondente — criando a fatura se ainda não existir.
 * Roda uma vez, na criação do plano; não depende de cron.
 */
export async function generateInstallmentPurchases(
    plan: {
    id: string;
    // createdAt: Date;
    userId: string | null;
    description: string;
    categoryId: string;
    cardId: string | null;
    createdById: string;
    totalAmount: number;
    installments: number;
    dayOfMonth: number;
    startDate: Date;
    groupId: string;
    // cancelledAt: Date | null;
},
): Promise<void> {

    



    const amounts = splitInstallments(plan.totalAmount, plan.installments);

    for (let index = 0; index < plan.installments; index++) {
        const purchasedAt = installmentDate(
            plan.startDate,
            plan.dayOfMonth,
            index,
        );

        const invoice = await getOrCreateInvoice({
            groupId: plan.groupId,
            targetDate: purchasedAt,
        });

        await prisma.purchase.upsert({
            where: {
                invoiceId_installmentPlanId: {
                    invoiceId: invoice.id,
                    installmentPlanId: plan.id,
                },
            },
            update: {}, // já existe essa parcela nessa fatura — não faz nada
            create: {
                installmentPlanId: plan.id,
                description: plan.description,
                amount: amounts[index],
                purchasedAt,
                categoryId: plan.categoryId,
                invoiceId: invoice.id,
                cardId: plan.cardId,
                userId: plan.userId,
                installmentNumber: index + 1,
                createdById: plan.createdById,
            },
        });
    }
}