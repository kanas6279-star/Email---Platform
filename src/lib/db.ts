import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across hot reloads in dev so we don't
// exhaust database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
