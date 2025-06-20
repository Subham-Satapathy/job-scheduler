"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../utils/logger");
// Load environment variables
dotenv_1.default.config();
class EnvironmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }
    addError(message) {
        this.errors.push(message);
    }
    addWarning(message) {
        this.warnings.push(message);
    }
    validateRequired(key, value, description) {
        if (!value || value.trim() === '') {
            this.addError(`${key} is required: ${description}`);
            return '';
        }
        return value.trim();
    }
    validateOptional(key, value, defaultValue) {
        if (!value || value.trim() === '') {
            this.addWarning(`${key} not set, using default: ${defaultValue}`);
            return defaultValue;
        }
        return value.trim();
    }
    validateNumber(key, value, defaultValue, description) {
        if (!value || value.trim() === '') {
            this.addWarning(`${key} not set, using default: ${defaultValue} (${description})`);
            return defaultValue;
        }
        const parsed = parseInt(value.trim(), 10);
        if (isNaN(parsed)) {
            this.addError(`${key} must be a valid number: ${description} (received: ${value})`);
            return defaultValue;
        }
        return parsed;
    }
    validateDatabaseUrl(url) {
        if (!url)
            return false;
        // Clean up URL by removing any whitespace/newlines
        const cleanUrl = url.replace(/\s+/g, '');
        // Check if it's a valid PostgreSQL URL (more flexible for cloud providers like Neon)
        const postgresRegex = /^postgresql:\/\/[^:\/\s]+:[^@\/\s]+@[^:\/\s]+[:\d]*\/[^?\s]+(\?.*)?$/;
        const isValid = postgresRegex.test(cleanUrl);
        if (!isValid) {
            this.addError(`DATABASE_URL must be a valid PostgreSQL connection string format: postgresql://user:password@host:port/database (received: ${url.substring(0, 30)}...)`);
        }
        return isValid;
    }
    validateRedisUrl(host, port, password) {
        // Construct Redis URL from components
        const auth = password ? `:${password}@` : '';
        return `redis://${auth}${host}:${port}`;
    }
    validate() {
        this.errors = [];
        this.warnings = [];
        logger_1.logger.info('Validating environment configuration...');
        // Server Configuration
        const PORT = this.validateNumber('PORT', process.env.PORT, 3000, 'Server port number');
        const NODE_ENV = this.validateOptional('NODE_ENV', process.env.NODE_ENV, 'development');
        // Database Configuration
        let DATABASE_URL = this.validateRequired('DATABASE_URL', process.env.DATABASE_URL, 'PostgreSQL database connection string');
        // Clean up DATABASE_URL by removing any whitespace/newlines
        if (DATABASE_URL) {
            DATABASE_URL = DATABASE_URL.replace(/\s+/g, '');
            this.validateDatabaseUrl(DATABASE_URL);
        }
        const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
        // Database Connection Pooling (only used variables)
        const DB_POOL_MAX = this.validateNumber('DB_POOL_MAX', process.env.DB_POOL_MAX, 100, 'Maximum number of connections in the pool');
        const DB_POOL_IDLE_TIMEOUT = this.validateNumber('DB_POOL_IDLE_TIMEOUT', process.env.DB_POOL_IDLE_TIMEOUT, 60000, 'Idle connection timeout in milliseconds');
        const DB_POOL_CONNECT_TIMEOUT = this.validateNumber('DB_POOL_CONNECT_TIMEOUT', process.env.DB_POOL_CONNECT_TIMEOUT, 5000, 'Connection timeout in milliseconds');
        const DB_ENABLE_PREPARED_STATEMENTS = this.validateOptional('DB_ENABLE_PREPARED_STATEMENTS', process.env.DB_ENABLE_PREPARED_STATEMENTS, 'true') === 'true';
        // Redis Configuration
        const REDIS_HOST = this.validateRequired('REDIS_HOST', process.env.REDIS_HOST, 'Redis server hostname');
        const REDIS_PORT = this.validateNumber('REDIS_PORT', process.env.REDIS_PORT, 6379, 'Redis server port');
        const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
        // Generate REDIS_URL if not provided
        let REDIS_URL = process.env.REDIS_URL;
        if (!REDIS_URL && REDIS_HOST) {
            REDIS_URL = this.validateRedisUrl(REDIS_HOST, REDIS_PORT, REDIS_PASSWORD);
            this.addWarning(`REDIS_URL not set, generated from components: ${REDIS_URL.replace(/:([^:@]+)@/, ':***@')}`);
        }
        else if (!REDIS_URL) {
            this.addError('REDIS_URL is required when REDIS_HOST is not available');
            REDIS_URL = '';
        }
        // Redis Connection Optimization (only used variables)
        const REDIS_MAX_RETRIES = this.validateNumber('REDIS_MAX_RETRIES', process.env.REDIS_MAX_RETRIES, 3, 'Maximum number of retries');
        const REDIS_RETRY_DELAY = this.validateNumber('REDIS_RETRY_DELAY', process.env.REDIS_RETRY_DELAY, 100, 'Retry delay in milliseconds');
        const REDIS_CONNECT_TIMEOUT = this.validateNumber('REDIS_CONNECT_TIMEOUT', process.env.REDIS_CONNECT_TIMEOUT, 5000, 'Redis connection timeout in milliseconds');
        // BullMQ Configuration
        const BULLMQ_PREFIX = this.validateOptional('BULLMQ_PREFIX', process.env.BULLMQ_PREFIX, 'bullmq');
        // Rate Limiting
        const RATE_LIMIT_IP_WINDOW_MS = this.validateNumber('RATE_LIMIT_IP_WINDOW_MS', process.env.RATE_LIMIT_IP_WINDOW_MS, 60000, 'IP rate limit window in milliseconds');
        const RATE_LIMIT_IP_MAX_REQUESTS = this.validateNumber('RATE_LIMIT_IP_MAX_REQUESTS', process.env.RATE_LIMIT_IP_MAX_REQUESTS, 12000, 'Maximum IP requests per window');
        // Logging
        const LOG_LEVEL = this.validateOptional('LOG_LEVEL', process.env.LOG_LEVEL, 'info');
        // Validate log level
        const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
        if (!validLogLevels.includes(LOG_LEVEL)) {
            this.addWarning(`LOG_LEVEL "${LOG_LEVEL}" is not a standard Winston level. Valid levels: ${validLogLevels.join(', ')}`);
        }
        // Log results
        this.logValidationResults();
        // Throw error if validation failed
        if (this.errors.length > 0) {
            const errorMessage = `Environment validation failed:\n${this.errors.map(e => `  ${e}`).join('\n')}`;
            throw new Error(errorMessage);
        }
        return {
            PORT,
            NODE_ENV,
            DATABASE_URL,
            TEST_DATABASE_URL,
            DB_POOL_MAX,
            DB_POOL_IDLE_TIMEOUT,
            DB_POOL_CONNECT_TIMEOUT,
            DB_ENABLE_PREPARED_STATEMENTS,
            REDIS_HOST,
            REDIS_PORT,
            REDIS_PASSWORD,
            REDIS_URL,
            REDIS_MAX_RETRIES,
            REDIS_RETRY_DELAY,
            REDIS_CONNECT_TIMEOUT,
            BULLMQ_PREFIX,
            RATE_LIMIT_IP_WINDOW_MS,
            RATE_LIMIT_IP_MAX_REQUESTS,
            LOG_LEVEL,
        };
    }
    logValidationResults() {
        // Log warnings
        if (this.warnings.length > 0) {
            logger_1.logger.warn('Environment configuration warnings:');
            this.warnings.forEach(warning => {
                logger_1.logger.warn(`  ${warning}`);
            });
        }
        // Log errors
        if (this.errors.length > 0) {
            logger_1.logger.error('Environment configuration errors:');
            this.errors.forEach(error => {
                logger_1.logger.error(`  ${error}`);
            });
        }
        else {
            logger_1.logger.info('Environment validation completed successfully');
        }
        // Log masked configuration for debugging
        if (this.errors.length === 0) {
            logger_1.logger.info('Environment configuration loaded:', {
                PORT: process.env.PORT || 3000,
                NODE_ENV: process.env.NODE_ENV || 'development',
                DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NOT_SET',
                REDIS_HOST: process.env.REDIS_HOST || 'NOT_SET',
                REDIS_PORT: process.env.REDIS_PORT || 6379,
                REDIS_URL: process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 15) + '...' : 'GENERATED',
                BULLMQ_PREFIX: process.env.BULLMQ_PREFIX || 'bullmq',
                LOG_LEVEL: process.env.LOG_LEVEL || 'info',
            });
        }
    }
}
// Create and export validated environment configuration
const validator = new EnvironmentValidator();
exports.envConfig = validator.validate();
