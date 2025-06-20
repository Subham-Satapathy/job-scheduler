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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const schema = __importStar(require("./schema"));
const isDevelopment = env_config_1.envConfig.NODE_ENV === 'development';
const isTest = env_config_1.envConfig.NODE_ENV === 'test';
const databaseUrl = isTest && env_config_1.envConfig.TEST_DATABASE_URL
    ? env_config_1.envConfig.TEST_DATABASE_URL
    : env_config_1.envConfig.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('Database URL is required');
}
logger_1.logger.info('Initializing database connection', {
    url: databaseUrl.substring(0, 30) + '...',
    environment: env_config_1.envConfig.NODE_ENV,
    isTest
});
const sql = (0, postgres_1.default)(databaseUrl, {
    max: env_config_1.envConfig.DB_POOL_MAX,
    idle_timeout: env_config_1.envConfig.DB_POOL_IDLE_TIMEOUT,
    connect_timeout: env_config_1.envConfig.DB_POOL_CONNECT_TIMEOUT,
    prepare: env_config_1.envConfig.DB_ENABLE_PREPARED_STATEMENTS,
    onnotice: isDevelopment ? (notice) => {
        logger_1.logger.debug('PostgreSQL notice:', notice);
    } : undefined,
    debug: isDevelopment ? (connection, query, parameters) => {
        logger_1.logger.debug('PostgreSQL query:', { query, parameters });
    } : false
});
const db = (0, postgres_js_1.drizzle)(sql, {
    schema,
    logger: isDevelopment ? {
        logQuery: (query, params) => {
            logger_1.logger.debug('Drizzle query:', { query, params });
        }
    } : false
});
exports.default = db;
