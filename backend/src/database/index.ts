import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Prevent JSON.stringify error with Prisma BigInt fields
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
