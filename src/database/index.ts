import { PrismaClient } from '@prisma/client';

// Prevent JSON.stringify error with Prisma BigInt fields
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
