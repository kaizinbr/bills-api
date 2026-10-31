import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { relations } from "./drizzle/relations";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle({ client, relations });