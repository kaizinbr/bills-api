import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db/index";
import {
    group as groupTable,
    invoice as invoiceTable,
    purchase as purchaseTable,
    subscription as subscriptionTable,
} from "@/db/drizzle/schema";

export type Invoice = typeof invoiceTable.$inferSelect;

// Fallback se a conta não tiver closingDay definido.
// Ajuste pro que fizer mais sentido pro seu caso (ex: 1 = fecha todo dia 1º).
const DEFAULT_CLOSING_DAY = 1;

// Limite de segurança para lançamentos retroativos: quantas faturas, no máximo,
// podem ser criadas para trás numa única chamada. Evita criar centenas de
// faturas por causa de uma data digitada errada (ex: ano 1926). 120 = 10 anos.
const MAX_RETROACTIVE_INVOICES = 120;

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

/**
 * Data de fechamento (fim do dia) do mês `monthIndex` (0-11) do ano `year`.
 * Aceita monthIndex fora de 0-11 (ex: -1 = dezembro do ano anterior).
 */
function closingDateForMonth(
    year: number,
    monthIndex: number,
    closingDay: number,
): Date {
    const normalizedYear = year + Math.floor(monthIndex / 12);
    const normalizedMonth = ((monthIndex % 12) + 12) % 12;
    const day = Math.min(
        closingDay,
        lastDayOfMonth(normalizedYear, normalizedMonth),
    );
    return new Date(
        Date.UTC(normalizedYear, normalizedMonth, day, 23, 59, 59, 999),
    );
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

type CreateInvoiceParams = {
    groupId: string;
    periodStart: Date;
    closingDate: Date;
    previousInvoice?: Invoice;
};

/**
 * Cria a fatura do mês de referência de `closingDate`. Se outra chamada
 * concorrente (ou uma chamada anterior) já criou essa fatura, devolve a
 * existente — buscada pela chave real (groupId + referenceYear/Month) — sem
 * cobrar as assinaturas de novo.
 */
async function createInvoice({
    groupId,
    periodStart,
    closingDate,
    previousInvoice,
}: CreateInvoiceParams): Promise<Invoice> {
    const { referenceYear, referenceMonth } =
        referenceFromClosingDate(closingDate);

    const created = await db.transaction(async (tx) => {
        if (previousInvoice && previousInvoice.status === "OPEN") {
            await tx
                .update(invoiceTable)
                .set({ status: "OPEN" })
                .where(eq(invoiceTable.id, previousInvoice.id));
        }

        const [row] = await tx
            .insert(invoiceTable)
            .values({
                groupId,
                periodStart,
                closingDate,
                referenceYear,
                referenceMonth,
                status: closingDate < new Date() ? "CLOSED" : "OPEN",
                updatedAt: new Date(),
            })
            .onConflictDoNothing()
            .returning();

        // undefined = a fatura desse mês já existe
        return row;
    });

    if (created) {
        await chargeSubscriptionsForInvoice({ invoice: created });
        return created;
    }

    const [existing] = await db
        .select()
        .from(invoiceTable)
        .where(
            and(
                eq(invoiceTable.groupId, groupId),
                eq(invoiceTable.referenceYear, referenceYear),
                eq(invoiceTable.referenceMonth, referenceMonth),
            ),
        )
        .limit(1);

    if (!existing) {
        throw new Error("Fatura não encontrada após conflito na criação.");
    }

    return existing;
}

/**
 * Cria faturas para trás, a partir da mais antiga que existe (`firstInvoice`),
 * até uma delas cobrir `targetDate`. O mês de cada fatura anterior vem do
 * referenceMonth da seguinte, e as datas usam o closingDay ATUAL da conta.
 */
async function createInvoicesBackwards({
    groupId,
    closingDay,
    firstInvoice,
    targetDate,
}: {
    groupId: string;
    closingDay: number;
    firstInvoice: Invoice;
    targetDate: Date;
}): Promise<Invoice> {
    let current = firstInvoice;
    let created = 0;

    while (targetDate < current.periodStart) {
        if (created >= MAX_RETROACTIVE_INVOICES) {
            throw new Error(
                `Data muito antiga: seriam criadas mais de ${MAX_RETROACTIVE_INVOICES} faturas retroativas.`,
            );
        }

        // referenceMonth é 1-12; o índice do mês da fatura atual é
        // referenceMonth - 1, então o mês anterior é referenceMonth - 2
        const closingDate = closingDateForMonth(
            current.referenceYear,
            current.referenceMonth - 2,
            closingDay,
        );
        const previousClosing = closingDateForMonth(
            current.referenceYear,
            current.referenceMonth - 3,
            closingDay,
        );
        // o período começa no dia seguinte ao fechamento da fatura anterior a ela
        const periodStart = new Date(
            Date.UTC(
                previousClosing.getUTCFullYear(),
                previousClosing.getUTCMonth(),
                previousClosing.getUTCDate() + 1,
            ),
        );

        const previous = await createInvoice({
            groupId,
            periodStart,
            closingDate,
        });
        created += 1;

        // data no "vão" entre o fechamento da fatura anterior e o início da
        // atual: pertence à fatura seguinte (mesma regra do fluxo pra frente)
        if (targetDate > previous.closingDate) {
            return current;
        }

        current = previous;
    }

    return current;
}

type GetOrCreateInvoiceParams = {
    groupId: string;
    targetDate: Date;
};

/**
 * Garante que existe uma fatura DA CONTA (não mais por cartão) cobrindo
 * `targetDate` e retorna ela. Cria em sequência quantas faturas forem
 * necessárias pra chegar até lá — para frente ou para trás —, cada uma com
 * closingDate calculado a partir do closingDay ATUAL da conta no momento da
 * criação — faturas já existentes nunca são recalculadas.
 */
export async function getOrCreateInvoice({
    groupId,
    targetDate,
}: GetOrCreateInvoiceParams): Promise<Invoice> {
    const [group] = await db
        .select()
        .from(groupTable)
        .where(eq(groupTable.id, groupId))
        .limit(1);

    if (!group) {
        throw new Error("Conta não encontrada.");
    }

    const closingDay = group.closingDay ?? DEFAULT_CLOSING_DAY;

    const [firstFound] = await db
        .select()
        .from(invoiceTable)
        .where(eq(invoiceTable.groupId, groupId))
        .orderBy(asc(invoiceTable.periodStart))
        .limit(1);

    let lastInvoice: Invoice;

    if (firstFound) {
        lastInvoice = firstFound;
    } else {
        // conta sem nenhuma fatura: começa pela fatura do período atual
        const periodStart = initialPeriodStart(new Date(), closingDay);
        lastInvoice = await createInvoice({
            groupId,
            periodStart,
            closingDate: nextClosingDate(periodStart, closingDay),
        });
    }

    // console.log("targetDate", targetDate)

    // já existe uma fatura cujo período cobre a data pedida
    if (
        targetDate >= lastInvoice.periodStart &&
        targetDate <= lastInvoice.closingDate
    ) {
        return lastInvoice;
    }

    // data anterior à primeira fatura da conta: gera as faturas para trás
    if (targetDate < lastInvoice.periodStart) {
        return createInvoicesBackwards({
            groupId,
            closingDay,
            firstInvoice: lastInvoice,
            targetDate,
        });
    }

    // data posterior: cria faturas em sequência até alcançar targetDate
    while (targetDate > lastInvoice.closingDate) {
        const previousInvoice = lastInvoice;
    // console.log("previousInvoice", previousInvoice)
        const periodStart = addDays(previousInvoice.closingDate, 1);
        const closingDate = nextClosingDate(periodStart, closingDay);

        lastInvoice = await createInvoice({
            groupId,
            periodStart,
            closingDate,
            previousInvoice,
        });
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
    const activeSubscriptions = await db
        .select()
        .from(subscriptionTable)
        .where(
            and(
                eq(subscriptionTable.groupId, invoice.groupId),
                lte(subscriptionTable.startDate, invoice.closingDate),
                or(
                    isNull(subscriptionTable.canceledAt),
                    gt(subscriptionTable.canceledAt, invoice.periodStart),
                ),
            ),
        );

    if (activeSubscriptions.length === 0) return;

    const rows = activeSubscriptions.map((subscription) => ({
        description: subscription.name,
        amount: subscription.amount,
        purchasedAt: clampToPeriod(
            nextClosingDate(invoice.periodStart, subscription.chargeDay),
            invoice.periodStart,
            invoice.closingDate,
        ),
        categoryId: subscription.categoryId,
        invoiceId: invoice.id,
        cardId: subscription.cardId,
        userId: subscription.userId,
        subscriptionId: subscription.id,
        createdById: subscription.createdById,
    }));

    // já existe cobrança dessa assinatura nessa fatura — não faz nada
    await db
        .insert(purchaseTable)
        .values(rows)
        .onConflictDoNothing({
            target: [purchaseTable.invoiceId, purchaseTable.subscriptionId],
        });
}