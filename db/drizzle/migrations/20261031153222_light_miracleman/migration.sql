ALTER TABLE "account" DROP COLUMN "issuer";--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account" ("accountId");