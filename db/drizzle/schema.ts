import {
    pgTable,
    pgEnum,
    uuid,
    text,
    timestamp,
    integer,
    boolean,
    uniqueIndex,
    index,
    foreignKey,
    primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const groupRole = pgEnum("group_role", ["OWNER", "MEMBER"]);
export const invoiceStatus = pgEnum("invoice_status", [
    "OPEN",
    "CLOSED",
    "PAID",
]);
export const categoryType = pgEnum("category_type", [
    "FOOD",
    "TRANSPORT",
    "SHOPPING",
    "HEALTH",
    "ENTERTAINMENT",
    "SUBSCRIPTION",
    "INSTALLMENT",
    "LOAN",
    "BILLS",
    "OTHER",
]);

export const account = pgTable(
    "account",
    {
        id: uuid().defaultRandom().primaryKey(),
        accountId: text().notNull(),
        providerId: text().notNull(),
        userId: uuid().notNull(),
        accessToken: text(),
        refreshToken: text(),
        idToken: text(),
        accessTokenExpiresAt: timestamp({ precision: 3 }),
        refreshTokenExpiresAt: timestamp({ precision: 3 }),
        scope: text(),
        password: text(),
        createdAt: timestamp({ precision: 3 }).notNull(),
        updatedAt: timestamp({ precision: 3 }).notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "account_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        uniqueIndex("account_issuer_accountId_key").using(
            "btree",
            table.accountId.asc().nullsLast(),
        ),
    ],
);

export const card = pgTable(
    "card",
    {
        id: uuid().defaultRandom().primaryKey(),
        name: text().notNull(),
        color: text(),
        digits: text(),
        closingDay: integer(),
        ownerId: uuid().notNull(),
        createdById: uuid().notNull(),
        archived: boolean().default(false).notNull(),
        groupId: uuid().notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "card_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [group.id],
            name: "card_groupId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.ownerId],
            foreignColumns: [user.id],
            name: "card_ownerId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        index("card_groupId_idx").using(
            "btree",
            table.groupId.asc().nullsLast(),
        ),
        index("card_ownerId_idx").using(
            "btree",
            table.ownerId.asc().nullsLast(),
        ),
    ],
);

export const category = pgTable(
    "category",
    {
        id: uuid().defaultRandom().primaryKey(),
        key: text().notNull(),
        label: text().notNull(),
        icon: text(),
        type: categoryType().default("OTHER").notNull(),
        createdById: uuid(),
        archived: boolean().default(false).notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "category_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        uniqueIndex("category_key_key").using(
            "btree",
            table.key.asc().nullsLast(),
        ),
        index("category_type_idx").using("btree", table.type.asc().nullsLast()),
    ],
);

export const group = pgTable(
    "group",
    {
        id: uuid().defaultRandom().primaryKey(),
        name: text().notNull(),
        debtorId: uuid(),
        creditorId: uuid(),
        creditorName: text(),
        closingDay: integer(),
        limit: integer(),
        inviteCode: text().notNull(),
        archived: boolean().default(false).notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.creditorId],
            foreignColumns: [user.id],
            name: "group_creditorId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        foreignKey({
            columns: [table.debtorId],
            foreignColumns: [user.id],
            name: "group_debtorId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        index("group_creditorId_idx").using(
            "btree",
            table.creditorId.asc().nullsLast(),
        ),
        index("group_debtorId_idx").using(
            "btree",
            table.debtorId.asc().nullsLast(),
        ),
        uniqueIndex("group_inviteCode_key").using(
            "btree",
            table.inviteCode.asc().nullsLast(),
        ),
    ],
);

export const groupMember = pgTable(
    "group_member",
    {
        id: uuid().defaultRandom().primaryKey(),
        groupId: uuid().notNull(),
        userId: uuid().notNull(),
        role: groupRole().default("MEMBER").notNull(),
        joinedAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [group.id],
            name: "group_member_groupId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "group_member_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        uniqueIndex("group_member_groupId_userId_key").using(
            "btree",
            table.groupId.asc().nullsLast(),
            table.userId.asc().nullsLast(),
        ),
        index("group_member_userId_idx").using(
            "btree",
            table.userId.asc().nullsLast(),
        ),
    ],
);

export const incomeEntry = pgTable(
    "income_entry",
    {
        id: uuid().defaultRandom().primaryKey(),
        invoiceId: uuid().notNull(),
        amount: integer().notNull(),
        description: text(),
        receivedAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        createdById: uuid().notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "income_entry_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.invoiceId],
            foreignColumns: [invoice.id],
            name: "income_entry_invoiceId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        index("income_entry_invoiceId_idx").using(
            "btree",
            table.invoiceId.asc().nullsLast(),
        ),
    ],
);

export const installmentPlan = pgTable(
    "installment_plan",
    {
        id: uuid().defaultRandom().primaryKey(),
        description: text().notNull(),
        totalAmount: integer().notNull(),
        installments: integer().notNull(),
        dayOfMonth: integer().notNull(),
        startDate: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
        cancelledAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date()),
        categoryId: uuid().notNull(),
        cardId: uuid(),
        groupId: uuid().notNull(),
        userId: uuid(),
        createdById: uuid().notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.cardId],
            foreignColumns: [card.id],
            name: "installment_plan_cardId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        foreignKey({
            columns: [table.categoryId],
            foreignColumns: [category.id],
            name: "installment_plan_categoryId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("restrict"),
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "installment_plan_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [group.id],
            name: "installment_plan_groupId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "installment_plan_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        index("installment_plan_cardId_idx").using(
            "btree",
            table.cardId.asc().nullsLast(),
        ),
        index("installment_plan_groupId_idx").using(
            "btree",
            table.groupId.asc().nullsLast(),
        ),
        index("installment_plan_userId_idx").using(
            "btree",
            table.userId.asc().nullsLast(),
        ),
    ],
);

export const invoice = pgTable(
    "invoice",
    {
        id: uuid().defaultRandom().primaryKey(),
        groupId: uuid().notNull(),
        periodStart: timestamp({ precision: 3 }).notNull(),
        closingDate: timestamp({ precision: 3 }).notNull(),
        referenceMonth: integer().notNull(),
        referenceYear: integer().notNull(),
        status: invoiceStatus().default("OPEN").notNull(),
        paidAt: timestamp({ precision: 3 }),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp({ precision: 3 }).notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [group.id],
            name: "invoice_groupId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        index("invoice_groupId_periodStart_idx").using(
            "btree",
            table.groupId.asc().nullsLast(),
            table.periodStart.asc().nullsLast(),
        ),
        uniqueIndex("invoice_groupId_referenceYear_referenceMonth_key").using(
            "btree",
            table.groupId.asc().nullsLast(),
            table.referenceYear.asc().nullsLast(),
            table.referenceMonth.asc().nullsLast(),
        ),
    ],
);

export const purchase = pgTable(
    "purchase",
    {
        id: uuid().defaultRandom().primaryKey(),
        description: text(),
        amount: integer().notNull(),
        purchasedAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        categoryId: uuid().notNull(),
        invoiceId: uuid().notNull(),
        cardId: uuid(),
        userId: uuid(),
        installmentPlanId: uuid(),
        installmentNumber: integer(),
        subscriptionId: uuid(),
        createdById: uuid().notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.cardId],
            foreignColumns: [card.id],
            name: "purchase_cardId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        foreignKey({
            columns: [table.categoryId],
            foreignColumns: [category.id],
            name: "purchase_categoryId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("restrict"),
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "purchase_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.installmentPlanId],
            foreignColumns: [installmentPlan.id],
            name: "purchase_installmentPlanId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        foreignKey({
            columns: [table.invoiceId],
            foreignColumns: [invoice.id],
            name: "purchase_invoiceId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.subscriptionId],
            foreignColumns: [subscription.id],
            name: "purchase_subscriptionId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "purchase_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        index("purchase_cardId_purchasedAt_idx").using(
            "btree",
            table.cardId.asc().nullsLast(),
            table.purchasedAt.asc().nullsLast(),
        ),
        index("purchase_categoryId_idx").using(
            "btree",
            table.categoryId.asc().nullsLast(),
        ),
        index("purchase_installmentPlanId_idx").using(
            "btree",
            table.installmentPlanId.asc().nullsLast(),
        ),
        uniqueIndex("purchase_invoiceId_installmentPlanId_key").using(
            "btree",
            table.invoiceId.asc().nullsLast(),
            table.installmentPlanId.asc().nullsLast(),
        ),
        index("purchase_invoiceId_purchasedAt_idx").using(
            "btree",
            table.invoiceId.asc().nullsLast(),
            table.purchasedAt.asc().nullsLast(),
        ),
        uniqueIndex("purchase_invoiceId_subscriptionId_key").using(
            "btree",
            table.invoiceId.asc().nullsLast(),
            table.subscriptionId.asc().nullsLast(),
        ),
        index("purchase_invoiceId_userId_idx").using(
            "btree",
            table.invoiceId.asc().nullsLast(),
            table.userId.asc().nullsLast(),
        ),
        index("purchase_subscriptionId_idx").using(
            "btree",
            table.subscriptionId.asc().nullsLast(),
        ),
    ],
);

export const session = pgTable(
    "session",
    {
        id: uuid().defaultRandom().primaryKey(),
        expiresAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
        token: text().notNull(),
        createdAt: timestamp({ precision: 3 }).notNull(),
        updatedAt: timestamp({ precision: 3 }).notNull(),
        ipAddress: text(),
        userAgent: text(),
        userId: uuid().notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "session_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        uniqueIndex("session_token_key").using(
            "btree",
            table.token.asc().nullsLast(),
        ),
    ],
);

export const subscription = pgTable(
    "subscription",
    {
        id: uuid().defaultRandom().primaryKey(),
        name: text().notNull(),
        amount: integer().notNull(),
        chargeDay: integer().notNull(),
        startDate: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        canceledAt: timestamp({ precision: 3 }),
        categoryId: uuid().notNull(),
        cardId: uuid(),
        groupId: uuid().notNull(),
        userId: uuid(),
        createdById: uuid().notNull(),
        createdAt: timestamp({ precision: 3 })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
        updatedAt: timestamp({ precision: 3 })
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.cardId],
            foreignColumns: [card.id],
            name: "subscription_cardId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.categoryId],
            foreignColumns: [category.id],
            name: "subscription_categoryId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("restrict"),
        foreignKey({
            columns: [table.createdById],
            foreignColumns: [user.id],
            name: "subscription_createdById_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [group.id],
            name: "subscription_groupId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: "subscription_userId_fkey",
        })
            .onUpdate("cascade")
            .onDelete("set null"),
        index("subscription_canceledAt_idx").using(
            "btree",
            table.canceledAt.asc().nullsLast(),
        ),
        index("subscription_cardId_idx").using(
            "btree",
            table.cardId.asc().nullsLast(),
        ),
        index("subscription_groupId_idx").using(
            "btree",
            table.groupId.asc().nullsLast(),
        ),
        index("subscription_userId_idx").using(
            "btree",
            table.userId.asc().nullsLast(),
        ),
    ],
);

export const user = pgTable(
    "user",
    {
        id: uuid().defaultRandom().primaryKey(),
        name: text().notNull(),
        email: text().notNull(),
        emailVerified: boolean().notNull(),
        image: text(),
        createdAt: timestamp({ precision: 3 }).notNull(),
        updatedAt: timestamp({ precision: 3 }).notNull(),
        color: text(),
    },
    (table) => [
        uniqueIndex("user_email_key").using(
            "btree",
            table.email.asc().nullsLast(),
        ),
    ],
);

export const verification = pgTable("verification", {
    id: uuid().defaultRandom().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ precision: 3 })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
    createdAt: timestamp({ precision: 3 })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
    updatedAt: timestamp({ precision: 3 })
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
});
