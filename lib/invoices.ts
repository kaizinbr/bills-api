import { prisma } from "@/lib/prisma";
import type { Invoice } from "@/lib/generated/prisma/client";

// Fallback se nem o cartão nem o grupo tiverem closingDay definido.
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

/**
 * Retorna a próxima data (>= from) cujo dia do mês seja `closingDay`.
 * Lida com meses mais curtos: closingDay=31 em fevereiro vira dia 28/29.
 */
function nextClosingDate(from: Date, closingDay: number): Date {
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

type GetOrCreateInvoiceParams = {
    groupId: string;
    cardId: string | null; // null = fatura "avulsa" do grupo (sem cartão)
    targetDate: Date;
};

/**
 * Garante que existe uma fatura cobrindo `targetDate` pro cartão (ou pro
 * balde avulso do grupo, se cardId for null) e retorna ela. Cria em
 * sequência quantas faturas forem necessárias pra chegar até lá, cada uma
 * com closingDate calculado a partir do closingDay ATUAL do cartão/grupo
 * no momento da criação — faturas já existentes nunca são recalculadas.
 */
export async function getOrCreateInvoice({
    groupId,
    cardId,
    targetDate,
}: GetOrCreateInvoiceParams): Promise<Invoice> {
    const group = await prisma.group.findUniqueOrThrow({
        where: { id: groupId },
    });
    const card = cardId
        ? await prisma.card.findUniqueOrThrow({ where: { id: cardId } })
        : null;

    const closingDay =
        card?.closingDay ?? group.closingDay ?? DEFAULT_CLOSING_DAY;

    let lastInvoice = await prisma.invoice.findFirst({
        where: { groupId },
        orderBy: { periodStart: "desc" },
    });

    // já existe uma fatura cujo período cobre a data pedida
    // console.log("lastInvoice", lastInvoice);
    // console.log("targetDate", targetDate);
    // console.log(targetDate >= lastInvoice!.periodStart)
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
    if (lastInvoice && targetDate < lastInvoice.periodStart) {
        throw new Error(
            "Data anterior à primeira fatura registrada para este cartão/grupo.",
        );
    }

    // cria faturas em sequência até alcançar targetDate
    while (!lastInvoice || targetDate > lastInvoice.closingDate) {
        const previousInvoice = lastInvoice;
        const periodStart = previousInvoice
            ? addDays(previousInvoice.closingDate, 1)
            : (card?.createdAt ?? group.createdAt);

        const closingDate = nextClosingDate(periodStart, closingDay);

        try {
            const newInvoice = await prisma.$transaction(async (tx) => {
                if (previousInvoice && previousInvoice.status === "OPEN") {
                    await tx.invoice.update({
                        where: { id: previousInvoice.id },
                        data: { status: "CLOSED" },
                    });
                }

                return tx.invoice.create({
                    data: {
                        groupId,
                        periodStart,
                        closingDate,
                        status: closingDate < new Date() ? "CLOSED" : "OPEN",
                    },
                });
            });

            if (cardId) {
                await generateSubscriptionPurchases(newInvoice);
            }

            lastInvoice = newInvoice;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            if (err?.code === "P2002") {
                lastInvoice = await prisma.invoice.findFirstOrThrow({
                    where: { groupId, cardId, periodStart },
                });
            } else {
                throw err;
            }
        }
    }

    return lastInvoice;
}

/**
 * Gera (de forma idempotente) uma Purchase pra cada assinatura ativa do
 * cartão dentro do período da fatura recém-criada.
 */
async function generateSubscriptionPurchases(invoice: Invoice): Promise<void> {
    if (!invoice.cardId) return;

    const activeSubscriptions = await prisma.subscription.findMany({
        where: {
            cardId: invoice.cardId,
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
            update: {}, // já existe pra essa fatura, não faz nada
            create: {
                amount: subscription.amount,
                purchasedAt: chargeDate,
                categoryId: subscription.categoryId,
                invoiceId: invoice.id,
                cardId: invoice.cardId,
                subscriptionId: subscription.id,
                createdById: subscription.createdById,
            },
        });
    }
}
