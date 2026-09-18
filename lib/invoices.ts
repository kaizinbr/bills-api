import { prisma } from "@/lib/prisma";
import type { Invoice } from "@/lib/generated/prisma/client";

// Fallback se a conta não tiver closingDay definido.
// Ajuste pro que fizer mais sentido pro seu caso (ex: 1 = fecha todo dia 1º).
const DEFAULT_CLOSING_DAY = 1;

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
    // dia 0 do mês seguinte = último dia do mês atual
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function initialPeriodStart(now: Date, closingDay: number): Date {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const currentClosingDay = Math.min(closingDay, lastDayOfMonth(year, month));

    // Se o fechamento já passou (ou é hoje), o período começa no dia seguinte
    // e termina no fechamento do mês seguinte.
    if (now.getUTCDate() >= currentClosingDay) {
        return new Date(Date.UTC(year, month, currentClosingDay + 1));
    }

    const previousMonth = month - 1;
    const previousYear = year + Math.floor(previousMonth / 12);
    const normalizedMonth = ((previousMonth % 12) + 12) % 12;
    const previousClosingDay = Math.min(
        closingDay,
        lastDayOfMonth(previousYear, normalizedMonth),
    );

    return new Date(
        Date.UTC(previousYear, normalizedMonth, previousClosingDay+1),
    );
}

/**
 * Retorna a próxima data (>= from) cujo dia do mês seja `closingDay`.
 * Lida com meses mais curtos: closingDay=31 em fevereiro vira dia 28/29.
 */
export function nextClosingDate(from: Date, closingDay: number): Date {
    const year = from.getUTCFullYear();
    const month = from.getUTCMonth();
    const day = Math.min(closingDay, lastDayOfMonth(year, month));
    let candidate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    if (candidate < from) {
        const nextMonthIndex = month + 1;
        const nextYear = year + Math.floor(nextMonthIndex / 12);
        const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
        const nextDay = Math.min(
            closingDay,
            lastDayOfMonth(nextYear, normalizedMonth),
        );
        candidate = new Date(
            Date.UTC(nextYear, normalizedMonth, nextDay, 23, 59, 59, 999),
        );
    }

    return candidate;
}

function clampToPeriod(date: Date, start: Date, end: Date): Date {
    if (date < start) return start;
    if (date > end) return end;
    return date;
}

/**
 * mês/ano de referência são fixos a partir do closingDate no momento da
 * criação da fatura — nunca recalculados depois (é isso que garante que
 * mudar o closingDay da conta não reescreve faturas já criadas).
 */
function referenceFromClosingDate(closingDate: Date): {
    referenceYear: number;
    referenceMonth: number;
} {
    return {
        referenceYear: closingDate.getUTCFullYear(),
        referenceMonth: closingDate.getUTCMonth() + 1, // 1-12
    };
}

type GetOrCreateInvoiceParams = {
    groupId: string;
    targetDate: Date;
};

/**
 * Garante que existe uma fatura DA CONTA (não mais por cartão) cobrindo
 * `targetDate` e retorna ela. Cria em sequência quantas faturas forem
 * necessárias pra chegar até lá, cada uma com closingDate calculado a
 * partir do closingDay ATUAL da conta no momento da criação — faturas já
 * existentes nunca são recalculadas.
 */
export async function getOrCreateInvoice({
    groupId,
    targetDate,
}: GetOrCreateInvoiceParams): Promise<Invoice> {
    const group = await prisma.group.findUniqueOrThrow({
        where: { id: groupId },
    });

    const closingDay = group.closingDay ?? DEFAULT_CLOSING_DAY;

    let lastInvoice = await prisma.invoice.findFirst({
        where: { groupId },
        orderBy: { periodStart: "asc" },
    });

    // já existe uma fatura cujo período cobre a data pedida
    if (
        lastInvoice &&
        targetDate >= lastInvoice.periodStart &&
        targetDate <= lastInvoice.closingDate
    ) {
        return lastInvoice;
    }

    // data anterior à primeira fatura já registrada — fora do escopo desta
    // função (lançamento retroativo antigo precisa de tratamento manual, ver
    // observação abaixo)
    console.log("targetDate", targetDate)
    if (lastInvoice && targetDate < lastInvoice.periodStart) {
        throw new Error(
            "Data anterior à primeira fatura registrada para esta conta.",
        );
    }

    // cria faturas em sequência até alcançar targetDate
    while (!lastInvoice || targetDate > lastInvoice.closingDate) {
        const previousInvoice = lastInvoice;
    console.log("previousInvoice", previousInvoice)
        const periodStart = previousInvoice
            ? addDays(previousInvoice.closingDate, 1)
            : initialPeriodStart(new Date(), closingDay);

        const closingDate = nextClosingDate(periodStart, closingDay);
        const { referenceYear, referenceMonth } =
            referenceFromClosingDate(closingDate);

        try {
            const newInvoice = await prisma.$transaction(async (tx) => {
                if (previousInvoice && previousInvoice.status === "OPEN") {
                    await tx.invoice.update({
                        where: { id: previousInvoice.id },
                        data: { status: "OPEN" },
                    });
                }

                return tx.invoice.create({
                    data: {
                        groupId,
                        periodStart,
                        closingDate,
                        referenceYear,
                        referenceMonth,
                        status: closingDate < new Date() ? "CLOSED" : "OPEN",
                    },
                });
            });

            await chargeSubscriptionsForInvoice({ invoice: newInvoice });

            lastInvoice = newInvoice;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            if (err?.code === "P2002") {
                // outra chamada concorrente já criou a fatura desse mês —
                // busca pela chave real (groupId + referenceYear/Month), não
                // mais por cardId/periodStart
                lastInvoice = await prisma.invoice.findFirstOrThrow({
                    where: { groupId, referenceYear, referenceMonth },
                });
            } else {
                throw err;
            }
        }
    }

    return lastInvoice;
}

/**
 * Gera (de forma idempotente) uma Purchase pra cada assinatura ativa DA
 * CONTA — de qualquer cartão — dentro do período da fatura recém-criada.
 * Cada Purchase nasce com o cardId e o userId (dono/subconta) da própria
 * assinatura.
 */
export async function chargeSubscriptionsForInvoice({
    invoice,
}: {
    invoice: Invoice;
}): Promise<void> {
    const activeSubscriptions = await prisma.subscription.findMany({
        where: {
            groupId: invoice.groupId,
            startDate: { lte: invoice.closingDate },
            OR: [
                { canceledAt: null },
                { canceledAt: { gt: invoice.periodStart } },
            ],
        },
    });

    for (const subscription of activeSubscriptions) {
        const chargeDate = clampToPeriod(
            nextClosingDate(invoice.periodStart, subscription.chargeDay),
            invoice.periodStart,
            invoice.closingDate,
        );

        await prisma.purchase.upsert({
            where: {
                invoiceId_subscriptionId: {
                    invoiceId: invoice.id,
                    subscriptionId: subscription.id,
                },
            },
            update: {}, // já existe cobrança dessa assinatura nessa fatura — não faz nada
            create: {
                description: subscription.name,
                amount: subscription.amount,
                purchasedAt: chargeDate,
                categoryId: subscription.categoryId,
                invoiceId: invoice.id,
                cardId: subscription.cardId,
                userId: subscription.userId,
                subscriptionId: subscription.id,
                createdById: subscription.createdById,
            },
        });
    }
}