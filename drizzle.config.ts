import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/drizzle/schema.ts',
  out: './db/drizzle/migrations',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  tablesFilter: ["!_prisma_migrations"],
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
} satisfies Config;