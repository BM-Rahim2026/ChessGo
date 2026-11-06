import { PrismaClient } from "@prisma/client";

// DATABASE_URL, or the variable Vercel's Supabase integration creates (POSTGRES_PRISMA_URL).
const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== "production") g.prisma = db;
