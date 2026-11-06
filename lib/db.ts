import { PrismaClient } from "@prisma/client";

/** DATABASE_URL, or the variable Vercel's Supabase integration creates (any custom prefix). */
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const suffix of ["POSTGRES_PRISMA_URL", "POSTGRES_URL"]) {
    const key = Object.keys(process.env).find((k) => k.endsWith(suffix));
    if (key && process.env[key]) return process.env[key];
  }
  return undefined;
}

const url = databaseUrl();
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== "production") g.prisma = db;
