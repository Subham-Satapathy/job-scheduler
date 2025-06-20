import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../db/schema';
import dotenv from 'dotenv';
dotenv.config();

// Use a separate test database URL, fallback to main database if not set
const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!;
const connection = postgres(testDatabaseUrl, {
  max: 1, // Single connection for tests
  prepare: false,
});

export const db = drizzle(connection, { schema });

export async function setupTestDatabase() {
  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });
}

export async function cleanupTestDatabase() {
  // Clean up test data
  await db.delete(schema.jobs);
}

// Increase test timeout for slower operations
jest.setTimeout(30000);

// Silence console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 