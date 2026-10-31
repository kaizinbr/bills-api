import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id
		}),
	},
	user: {
		accounts: r.many.account(),
		cardsCreatedById: r.many.card({
			alias: "card_createdById_user_id"
		}),
		cardsOwnerId: r.many.card({
			alias: "card_ownerId_user_id"
		}),
		categories: r.many.category(),
		groupsCreditorId: r.many.group({
			alias: "group_creditorId_user_id"
		}),
		groupsDebtorId: r.many.group({
			alias: "group_debtorId_user_id"
		}),
		groupsViaGroupMember: r.many.group({
			alias: "group_id_user_id_via_groupMember"
		}),
		groupMembers: r.many.groupMember(),
		invoices: r.many.invoice({
			from: r.user.id.through(r.incomeEntry.createdById),
			to: r.invoice.id.through(r.incomeEntry.invoiceId)
		}),
		incomeEntries: r.many.incomeEntry(),
		installmentPlansCreatedById: r.many.installmentPlan({
			alias: "installmentPlan_createdById_user_id"
		}),
		installmentPlansUserId: r.many.installmentPlan({
			alias: "installmentPlan_userId_user_id"
		}),
		purchasesCreatedById: r.many.purchase({
			alias: "purchase_createdById_user_id"
		}),
		purchasesUserId: r.many.purchase({
			alias: "purchase_userId_user_id"
		}),
		sessions: r.many.session(),
		subscriptionsCreatedById: r.many.subscription({
			alias: "subscription_createdById_user_id"
		}),
		subscriptionsUserId: r.many.subscription({
			alias: "subscription_userId_user_id"
		}),
	},
	card: {
		userCreatedById: r.one.user({
			from: r.card.createdById,
			to: r.user.id,
			alias: "card_createdById_user_id"
		}),
		group: r.one.group({
			from: r.card.groupId,
			to: r.group.id
		}),
		userOwnerId: r.one.user({
			from: r.card.ownerId,
			to: r.user.id,
			alias: "card_ownerId_user_id"
		}),
		installmentPlans: r.many.installmentPlan(),
		purchases: r.many.purchase(),
		subscriptions: r.many.subscription(),
	},
	group: {
		cards: r.many.card(),
		userCreditorId: r.one.user({
			from: r.group.creditorId,
			to: r.user.id,
			alias: "group_creditorId_user_id"
		}),
		userDebtorId: r.one.user({
			from: r.group.debtorId,
			to: r.user.id,
			alias: "group_debtorId_user_id"
		}),
		users: r.many.user({
			from: r.group.id.through(r.groupMember.groupId),
			to: r.user.id.through(r.groupMember.userId),
			alias: "group_id_user_id_via_groupMember"
		}),
		groupMembers: r.many.groupMember(),
		installmentPlans: r.many.installmentPlan(),
		invoices: r.many.invoice(),
		subscriptions: r.many.subscription(),
	},
	category: {
		user: r.one.user({
			from: r.category.createdById,
			to: r.user.id
		}),
		installmentPlans: r.many.installmentPlan(),
		purchases: r.many.purchase(),
		subscriptions: r.many.subscription(),
	},
	groupMember: {
		group: r.one.group({
			from: r.groupMember.groupId,
			to: r.group.id
		}),
		user: r.one.user({
			from: r.groupMember.userId,
			to: r.user.id
		}),
	},
	invoice: {
		users: r.many.user(),
		incomeEntries: r.many.incomeEntry(),
		group: r.one.group({
			from: r.invoice.groupId,
			to: r.group.id
		}),
		purchases: r.many.purchase(),
	},
	incomeEntry: {
		user: r.one.user({
			from: r.incomeEntry.createdById,
			to: r.user.id
		}),
		invoice: r.one.invoice({
			from: r.incomeEntry.invoiceId,
			to: r.invoice.id
		}),
	},
	installmentPlan: {
		card: r.one.card({
			from: r.installmentPlan.cardId,
			to: r.card.id
		}),
		category: r.one.category({
			from: r.installmentPlan.categoryId,
			to: r.category.id
		}),
		userCreatedById: r.one.user({
			from: r.installmentPlan.createdById,
			to: r.user.id,
			alias: "installmentPlan_createdById_user_id"
		}),
		group: r.one.group({
			from: r.installmentPlan.groupId,
			to: r.group.id
		}),
		userUserId: r.one.user({
			from: r.installmentPlan.userId,
			to: r.user.id,
			alias: "installmentPlan_userId_user_id"
		}),
		purchases: r.many.purchase(),
	},
	purchase: {
		card: r.one.card({
			from: r.purchase.cardId,
			to: r.card.id
		}),
		category: r.one.category({
			from: r.purchase.categoryId,
			to: r.category.id
		}),
		userCreatedById: r.one.user({
			from: r.purchase.createdById,
			to: r.user.id,
			alias: "purchase_createdById_user_id"
		}),
		installmentPlan: r.one.installmentPlan({
			from: r.purchase.installmentPlanId,
			to: r.installmentPlan.id
		}),
		invoice: r.one.invoice({
			from: r.purchase.invoiceId,
			to: r.invoice.id
		}),
		subscription: r.one.subscription({
			from: r.purchase.subscriptionId,
			to: r.subscription.id
		}),
		userUserId: r.one.user({
			from: r.purchase.userId,
			to: r.user.id,
			alias: "purchase_userId_user_id"
		}),
	},
	subscription: {
		purchases: r.many.purchase(),
		card: r.one.card({
			from: r.subscription.cardId,
			to: r.card.id
		}),
		category: r.one.category({
			from: r.subscription.categoryId,
			to: r.category.id
		}),
		userCreatedById: r.one.user({
			from: r.subscription.createdById,
			to: r.user.id,
			alias: "subscription_createdById_user_id"
		}),
		group: r.one.group({
			from: r.subscription.groupId,
			to: r.group.id
		}),
		userUserId: r.one.user({
			from: r.subscription.userId,
			to: r.user.id,
			alias: "subscription_userId_user_id"
		}),
	},
	session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id
		}),
	},
}))