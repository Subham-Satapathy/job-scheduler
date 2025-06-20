import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { envConfig } from '../config/env.config';
import { logger } from '../utils/logger';
import * as schema from './schema';

const isDevelopment = envConfig.NODE_ENV === 'development';
const isTest = envConfig.NODE_ENV === 'test';

const databaseUrl = isTest && envConfig.TEST_DATABASE_URL 
  ? envConfig.TEST_DATABASE_URL 
  : envConfig.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Database URL is required');
}

logger.info('Initializing database connection', {
  url: databaseUrl.substring(0, 30) + '...',
  environment: envConfig.NODE_ENV,
  isTest
});

const sql = postgres(databaseUrl, {
  max: envConfig.DB_POOL_MAX,
  idle_timeout: envConfig.DB_POOL_IDLE_TIMEOUT,
  connect_timeout: envConfig.DB_POOL_CONNECT_TIMEOUT,
  prepare: envConfig.DB_ENABLE_PREPARED_STATEMENTS,
  onnotice: isDevelopment ? (notice) => {
    logger.debug('PostgreSQL notice:', notice);
  } : undefined,
  debug: isDevelopment ? (connection, query, parameters) => {
    logger.debug('PostgreSQL query:', { query, parameters });
  } : false
});

const db = drizzle(sql, { 
  schema,
  logger: isDevelopment ? {
    logQuery: (query, params) => {
      logger.debug('Drizzle query:', { query, params });
    }
  } : false
});

export default db; 