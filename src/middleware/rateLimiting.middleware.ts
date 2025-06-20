import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { cacheService } from '../services/cache.service';
import { envConfig } from '../config/env.config';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';

// Proven Redis-backed rate limiter using express-rate-limit + rate-limit-redis
class ProvenRateLimiter {
  private static rateLimiter: any;
  private static initialized = false;

  public static async initialize(): Promise<void> {
    try {
      const redisClient = cacheService.getClient();
      
      if (!redisClient) {
        throw new Error('Redis client not available for rate limiting');
      }

      const store = new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });

      ProvenRateLimiter.rateLimiter = rateLimit({
        store,
        windowMs: envConfig.RATE_LIMIT_IP_WINDOW_MS,
        max: envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
        
        message: {
          error: 'Too many requests from this IP',
          retryAfter: Math.ceil(envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000),
          limit: envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
          windowMs: envConfig.RATE_LIMIT_IP_WINDOW_MS,
          rateLimitType: 'ip'
        },
        
        standardHeaders: true,
        legacyHeaders: false,
        
        keyGenerator: (req) => {
          const forwarded = req.headers['x-forwarded-for'] as string;
          const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
          return `ip:${ip}`;
        },

        skip: (req) => {
          return false;
        },

        handler: (req: Request, res: Response) => {
          const ip = req.headers['x-forwarded-for'] || req.ip;
          logger.warn('IP rate limit exceeded', { 
            ip,
            path: req.path,
            method: req.method,
            userAgent: req.headers['user-agent']
          });
          
          res.status(429).json({
            error: 'Too many requests from this IP',
            retryAfter: Math.ceil(envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000),
            limit: envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
            windowMs: envConfig.RATE_LIMIT_IP_WINDOW_MS,
            rateLimitType: 'ip'
          });
        }
      });

      ProvenRateLimiter.initialized = true;
      logger.info('Proven rate limiter initialized with express-rate-limit + Redis store');
    } catch (error) {
      logger.error('Failed to initialize proven rate limiter:', error);
      throw error;
    }
  }

  public static isInitialized(): boolean {
    return ProvenRateLimiter.initialized;
  }

  // Middleware getter
  public static get middleware() {
    if (!ProvenRateLimiter.initialized) {
      throw new Error('Rate limiter not initialized. Call initialize() first.');
    }
    return ProvenRateLimiter.rateLimiter;
  }

  // Statistics method for monitoring
  public static async getStatistics(): Promise<any> {
    try {
      const redisClient = cacheService.getClient();
      if (!redisClient) {
        return { error: 'Redis client not available' };
      }

      const keys = await redisClient.keys('rl:*');
      const totalActiveKeys = keys.length;

      return {
        totalActiveConnections: totalActiveKeys,
        windowMs: envConfig.RATE_LIMIT_IP_WINDOW_MS,
        maxRequestsPerWindow: envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
        maxRPS: Math.round(envConfig.RATE_LIMIT_IP_MAX_REQUESTS / (envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000)),
        activeIPs: totalActiveKeys,
        rateLimitingEnabled: ProvenRateLimiter.initialized
      };
    } catch (error) {
      logger.error('Failed to get rate limit statistics:', error);
      return { error: 'Failed to retrieve statistics' };
    }
  }
}

export { ProvenRateLimiter }; 