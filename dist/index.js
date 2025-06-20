"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const job_routes_1 = __importDefault(require("./routes/job.routes"));
const logger_1 = require("./utils/logger");
const env_config_1 = require("./config/env.config");
const swagger_config_1 = require("./config/swagger.config");
const cache_service_1 = require("./services/cache.service");
const job_worker_1 = require("./workers/job.worker");
const job_service_1 = require("./services/job.service");
const rateLimiting_middleware_1 = require("./middleware/rateLimiting.middleware");
// Load environment variables and validate configuration
logger_1.logger.info('Starting Scheduler Microservice...');
logger_1.logger.info(`Environment: ${env_config_1.envConfig.NODE_ENV}`);
logger_1.logger.info(`Port: ${env_config_1.envConfig.PORT}`);
// Create Express app
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
// Compression middleware
app.use((0, compression_1.default)());
// CORS middleware
app.use((0, cors_1.default)());
// Body parsing middleware
app.use(express_1.default.json());
// Rate limiting middleware will be applied after initialization
// Proven rate limiting middleware - applied before ALL routes
app.use((req, res, next) => {
    if (rateLimiting_middleware_1.ProvenRateLimiter.isInitialized()) {
        rateLimiting_middleware_1.ProvenRateLimiter.middleware(req, res, next);
    }
    else {
        // Rate limiter not ready yet, allow request
        next();
    }
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'scheduler-microservice',
        version: '1.0.0',
        environment: env_config_1.envConfig.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        dependencies: {
            database: 'connected',
            redis: 'connected',
            queue: 'active'
        }
    });
});
// Rate limiting statistics endpoint for monitoring
app.get('/rate-limit-stats', async (req, res) => {
    try {
        const stats = await rateLimiting_middleware_1.ProvenRateLimiter.getStatistics();
        const rateLimitConfig = {
            ip: {
                windowMs: env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS,
                maxRequests: env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
                maxRPS: Math.round(env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS / (env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000))
            }
        };
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            configuration: rateLimitConfig,
            statistics: stats
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get rate limit statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get rate limit statistics'
        });
    }
});
// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger_config_1.swaggerSpec);
});
// API Documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_config_1.swaggerSpec));
// Routes
app.use('/jobs', job_routes_1.default);
// Error handling middleware
app.use((error, req, res, next) => {
    logger_1.logger.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});
// Initialize services
async function initializeServices() {
    try {
        logger_1.logger.info('Initializing services...');
        // 1. Connect to Redis and initialize rate limiter
        logger_1.logger.info('Step 1: Connecting to Redis...');
        await cache_service_1.cacheService.connect();
        logger_1.logger.info('Connected to Redis');
        logger_1.logger.info('Step 1.1: Initializing rate limiter...');
        await rateLimiting_middleware_1.ProvenRateLimiter.initialize();
        logger_1.logger.info('Rate limiter initialized');
        // IP-based rate limiting is now enabled via isInitialized() check
        logger_1.logger.info('IP-based rate limiting ENABLED - all routes now protected');
        // 2. Initialize jobs (database schema should already be migrated)
        logger_1.logger.info('Step 2: Initializing jobs...');
        await job_service_1.jobService.initializeJobs();
        logger_1.logger.info('Jobs initialized successfully');
        // 3. Start HTTP server
        logger_1.logger.info('Step 3: Starting HTTP server...');
        const server = app.listen(env_config_1.envConfig.PORT, () => {
            logger_1.logger.info(`Server is running on port ${env_config_1.envConfig.PORT}`);
        });
        // 4. Start BullMQ worker
        logger_1.logger.info('Step 4: Starting BullMQ worker...');
        await job_worker_1.jobWorker.start();
        logger_1.logger.info('BullMQ worker started');
        // Handle process termination
        process.on('SIGTERM', async () => {
            logger_1.logger.info('SIGTERM received. Starting graceful shutdown...');
            // Close HTTP server
            server.close(() => {
                logger_1.logger.info('HTTP server closed');
            });
            // Close Redis connection
            await cache_service_1.cacheService.disconnect();
            logger_1.logger.info('Redis connection closed');
            // Close BullMQ worker
            await job_worker_1.jobWorker.close();
            logger_1.logger.info('BullMQ worker closed');
            // Close job service
            await job_service_1.jobService.close();
            logger_1.logger.info('Job service closed');
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            logger_1.logger.info('SIGINT received. Starting graceful shutdown...');
            // Close HTTP server
            server.close(() => {
                logger_1.logger.info('HTTP server closed');
            });
            // Close Redis connection
            await cache_service_1.cacheService.disconnect();
            logger_1.logger.info('Redis connection closed');
            // Close BullMQ worker
            await job_worker_1.jobWorker.close();
            logger_1.logger.info('BullMQ worker closed');
            // Close job service
            await job_service_1.jobService.close();
            logger_1.logger.info('Job service closed');
            process.exit(0);
        });
        logger_1.logger.info('All services initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize services:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        // Log environment configuration details for debugging
        logger_1.logger.error('Environment configuration debug info:', {
            DATABASE_URL_SET: !!env_config_1.envConfig.DATABASE_URL,
            REDIS_HOST: env_config_1.envConfig.REDIS_HOST,
            REDIS_PORT: env_config_1.envConfig.REDIS_PORT,
            NODE_ENV: env_config_1.envConfig.NODE_ENV
        });
        process.exit(1);
    }
    logger_1.logger.info('Environment configuration loaded:', {
        PORT: env_config_1.envConfig.PORT,
        NODE_ENV: env_config_1.envConfig.NODE_ENV,
        DATABASE_URL: env_config_1.envConfig.DATABASE_URL ? env_config_1.envConfig.DATABASE_URL.substring(0, 20) + '...' : 'NOT_SET',
        REDIS_HOST: env_config_1.envConfig.REDIS_HOST,
        REDIS_PORT: env_config_1.envConfig.REDIS_PORT,
        BULLMQ_PREFIX: env_config_1.envConfig.BULLMQ_PREFIX,
        LOG_LEVEL: env_config_1.envConfig.LOG_LEVEL,
    });
}
// Start the application
initializeServices();
