import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { envConfig } from '../config/env.config';

class CacheService {
  private client: RedisClientType;

  private static readonly CACHE_KEYS = {
    JOB: 'job',
    JOBS_ALL: 'jobs:all',
    JOBS_UPCOMING: 'jobs:upcoming',
    DUPLICATE_CHECK: 'job:duplicate',
  };

  constructor() {
    this.client = createClient({
      url: envConfig.REDIS_URL,
      socket: {
        connectTimeout: envConfig.REDIS_CONNECT_TIMEOUT,
        reconnectStrategy: (retries: number) => {
          if (retries > envConfig.REDIS_MAX_RETRIES) {
            logger.error('Redis connection failed after max retries');
            return false;
          }
          return Math.min(retries * envConfig.REDIS_RETRY_DELAY, 3000);
        }
      }
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Connected to Redis cache');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Disconnected from Redis cache');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      return false;
    }
  }

  async invalidateJobListCaches(): Promise<void> {
    try {
      const keys = await this.client.keys(`${CacheService.CACHE_KEYS.JOBS_ALL}:*`);
      const upcomingKeys = await this.client.keys(`${CacheService.CACHE_KEYS.JOBS_UPCOMING}:*`);
      const allKeys = [...keys, ...upcomingKeys];
      
      if (allKeys.length > 0) {
        await this.client.del(allKeys);
        logger.debug(`Invalidated ${allKeys.length} job list cache keys`);
      }
    } catch (error) {
      logger.error('Failed to invalidate job list caches:', error);
    }
  }

  async invalidateAllJobCaches(jobId?: number): Promise<void> {
    try {
      const patterns = [
        `${CacheService.CACHE_KEYS.JOB}:*`,
        `${CacheService.CACHE_KEYS.JOBS_ALL}:*`,
        `${CacheService.CACHE_KEYS.JOBS_UPCOMING}:*`,
      ];
      
      if (jobId) {
        patterns.push(`${CacheService.CACHE_KEYS.DUPLICATE_CHECK}:*`);
      }

      const allKeys: string[] = [];
      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        allKeys.push(...keys);
      }
      
      if (allKeys.length > 0) {
        await this.client.del(allKeys);
        logger.debug(`Invalidated ${allKeys.length} cache keys${jobId ? ` for job ${jobId}` : ''}`);
      }
    } catch (error) {
      logger.error('Failed to invalidate caches:', error);
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }
}

export const cacheService = new CacheService(); 