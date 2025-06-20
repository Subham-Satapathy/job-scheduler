import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import helmet from 'helmet';
import compression from 'compression';
import jobRoutes from './routes/job.routes';
import { logger } from './utils/logger';
import { envConfig } from './config/env.config';
import { swaggerSpec } from './config/swagger.config';
import { cacheService } from './services/cache.service';
import { jobWorker } from './workers/job.worker';
import { jobService } from './services/job.service';
import { ProvenRateLimiter } from './middleware/rateLimiting.middleware';

// Load environment variables and validate configuration
logger.info('Starting Scheduler Microservice...');
logger.info(`Environment: ${envConfig.NODE_ENV}`);
logger.info(`Port: ${envConfig.PORT}`);

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors());

// Body parsing middleware
app.use(express.json());

// Rate limiting middleware will be applied after initialization

// Proven rate limiting middleware - applied before ALL routes
app.use((req, res, next) => {
  if (ProvenRateLimiter.isInitialized()) {
    ProvenRateLimiter.middleware(req, res, next);
  } else {
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
    environment: envConfig.NODE_ENV,
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
    const stats = await ProvenRateLimiter.getStatistics();
    const rateLimitConfig = {
      ip: {
        windowMs: envConfig.RATE_LIMIT_IP_WINDOW_MS,
        maxRequests: envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
        maxRPS: Math.round(envConfig.RATE_LIMIT_IP_MAX_REQUESTS / (envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000))
      }
    };

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      configuration: rateLimitConfig,
      statistics: stats
    });
  } catch (error) {
    logger.error('Failed to get rate limit statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get rate limit statistics'
    });
  }
});

// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/jobs', jobRoutes);

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // 1. Connect to Redis and initialize rate limiter
    logger.info('Step 1: Connecting to Redis...');
    await cacheService.connect();
    logger.info('Connected to Redis');
    
    logger.info('Step 1.1: Initializing rate limiter...');
    await ProvenRateLimiter.initialize();
    logger.info('Rate limiter initialized');
    
    // IP-based rate limiting is now enabled via isInitialized() check
    logger.info('IP-based rate limiting ENABLED - all routes now protected');

    // 2. Initialize jobs (database schema should already be migrated)
    logger.info('Step 2: Initializing jobs...');
    await jobService.initializeJobs();
    logger.info('Jobs initialized successfully');

    // 3. Start HTTP server
    logger.info('Step 3: Starting HTTP server...');
    const server = app.listen(envConfig.PORT, () => {
      logger.info(`Server is running on port ${envConfig.PORT}`);
    });

    // 4. Start BullMQ worker
    logger.info('Step 4: Starting BullMQ worker...');
    await jobWorker.start();
    logger.info('BullMQ worker started');

    // Handle process termination
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Starting graceful shutdown...');
      
      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close Redis connection
      await cacheService.disconnect();
      logger.info('Redis connection closed');

      // Close BullMQ worker
      await jobWorker.close();
      logger.info('BullMQ worker closed');

      // Close job service
      await jobService.close();
      logger.info('Job service closed');

      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received. Starting graceful shutdown...');
      
      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close Redis connection
      await cacheService.disconnect();
      logger.info('Redis connection closed');

      // Close BullMQ worker
      await jobWorker.close();
      logger.info('BullMQ worker closed');

      // Close job service
      await jobService.close();
      logger.info('Job service closed');

      process.exit(0);
    });

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Log environment configuration details for debugging
    logger.error('Environment configuration debug info:', {
      DATABASE_URL_SET: !!envConfig.DATABASE_URL,
      REDIS_HOST: envConfig.REDIS_HOST,
      REDIS_PORT: envConfig.REDIS_PORT,
      NODE_ENV: envConfig.NODE_ENV
    });
    
    process.exit(1);
  }

  logger.info('Environment configuration loaded:', {
    PORT: envConfig.PORT,
    NODE_ENV: envConfig.NODE_ENV,
    DATABASE_URL: envConfig.DATABASE_URL ? envConfig.DATABASE_URL.substring(0, 20) + '...' : 'NOT_SET',
    REDIS_HOST: envConfig.REDIS_HOST,
    REDIS_PORT: envConfig.REDIS_PORT,
    BULLMQ_PREFIX: envConfig.BULLMQ_PREFIX,
    LOG_LEVEL: envConfig.LOG_LEVEL,
  });
}

// Start the application
initializeServices(); 