"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.checkDatabaseSchema = checkDatabaseSchema;
exports.ensureDatabaseSchema = ensureDatabaseSchema;
const migrator_1 = require("drizzle-orm/neon-http/migrator");
const serverless_1 = require("@neondatabase/serverless");
const neon_http_1 = require("drizzle-orm/neon-http");
const logger_1 = require("../utils/logger");
const env_config_1 = require("../config/env.config");
const schema = __importStar(require("./schema"));
async function runMigrations() {
    try {
        logger_1.logger.info('Starting database migration...');
        // Create connection for migration
        const sql = (0, serverless_1.neon)(env_config_1.envConfig.DATABASE_URL);
        const db = (0, neon_http_1.drizzle)(sql, { schema });
        // Run migrations
        await (0, migrator_1.migrate)(db, { migrationsFolder: './drizzle' });
        logger_1.logger.info('✅ Database migration completed successfully');
    }
    catch (error) {
        logger_1.logger.error('❌ Database migration failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error(`Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function checkDatabaseSchema() {
    try {
        logger_1.logger.info('Checking database schema...');
        const sql = (0, serverless_1.neon)(env_config_1.envConfig.DATABASE_URL);
        const db = (0, neon_http_1.drizzle)(sql, { schema });
        // Try to query the jobs table to verify schema exists
        await db.select().from(schema.jobs).limit(1);
        logger_1.logger.info('✅ Database schema verification successful');
        return true;
    }
    catch (error) {
        logger_1.logger.warn('⚠️  Database schema check failed:', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}
async function ensureDatabaseSchema() {
    logger_1.logger.info('Ensuring database schema is ready...');
    const schemaExists = await checkDatabaseSchema();
    if (!schemaExists) {
        logger_1.logger.info('Database schema missing, running migrations...');
        await runMigrations();
    }
    else {
        logger_1.logger.info('Database schema already exists, skipping migration');
    }
}
