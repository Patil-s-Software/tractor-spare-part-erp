import app from './app';
import { config } from './config';
import { prisma } from './database';

async function startServer() {
  app.listen(config.port, async () => {
    console.log(`[Server] Tractor ERP backend listening on http://localhost:${config.port} (${config.nodeEnv})`);

    try {
      await prisma.$connect();
      console.log('[Database] Connected successfully to PostgreSQL');
    } catch (error: any) {
      console.warn('-------------------------------------------------------------------');
      console.warn('[Database Warning] Could not connect to PostgreSQL database server.');
      console.warn('Details:', error.message || error);
      console.warn('Please ensure PostgreSQL is running at localhost:5432 and run:');
      console.warn('  npx prisma migrate dev');
      console.warn('  npm run seed (or ts-node src/database/seed.ts)');
      console.warn('-------------------------------------------------------------------');
    }
  });
}

startServer();
