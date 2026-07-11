/**
 * Prisma Client singleton.
 *
 * In dev, nodemon hot-reloads modules, which can spawn many PrismaClient
 * instances and exhaust DB connections. We stash the client on `global`
 * so repeated requires reuse the same instance — a standard Prisma pattern.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
