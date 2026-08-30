import app from './app';
import { config } from './config';
import { prisma } from './database';

async function startServer() {
  app.listen(config.port, async () => {
    console.log(`[Server] Tractor ERP backend listening on http://localhost:${config.port} (${config.nodeEnv})`);

    try {
      await prisma.$connect();
      console.log('[Database] Connected successfully to MySQL');
    } catch (error: any) {
      console.warn('-------------------------------------------------------------------');
      console.warn('[Database Warning] Could not connect to MySQL database server.');
      console.warn('Details:', error.message || error);
      console.warn(`Please ensure MySQL is running at ${config.dbHost}:${config.dbPort} and run:`);
      console.warn('  npx prisma migrate dev (or npx prisma db push)');
      console.warn('  npm run seed (or ts-node src/database/seed.ts)');
      console.warn('-------------------------------------------------------------------');
    }
  });
}

startServer();
