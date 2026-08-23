import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresInDays: 7,
  logLevel: process.env.LOG_LEVEL || 'info',
};
