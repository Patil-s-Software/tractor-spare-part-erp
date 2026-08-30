import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Builds the MySQL connection URL dynamically from individual DB_* env vars.
 * This avoids hardcoding passwords and handles special characters safely via
 * encodeURIComponent (e.g. pass@123 → pass%40123 automatically).
 *
 * Priority:
 *   1. Explicit DATABASE_URL (set directly → used as-is, handy for PlanetScale / RDS URLs)
 *   2. Individual DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME vars
 *
 * Local  (.env)       → use DB_* parts
 * Prod   (EC2 / Docker env-file) → use DB_* parts or override with DATABASE_URL
 */
function buildDatabaseUrl(): string {
  // If a full URL is already provided, trust it directly.
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host     = process.env.DB_HOST     || 'localhost';
  const port     = process.env.DB_PORT     || '3306';
  const user     = process.env.DB_USER     || 'root';
  const password = process.env.DB_PASSWORD || '';
  const name     = process.env.DB_NAME     || 'tractor_erp';

  // encodeURIComponent escapes @, #, $, spaces, etc. so the URL stays valid.
  const encodedPassword = encodeURIComponent(password);
  const url = `mysql://${user}:${encodedPassword}@${host}:${port}/${name}`;
  
  process.env.DATABASE_URL = url;
  return url;
}

const databaseUrl = buildDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || '3306',
  databaseUrl,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresInDays: 7,
  logLevel: process.env.LOG_LEVEL || 'info',
};
