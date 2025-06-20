"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
const env_config_1 = require("../config/env.config");
class CacheService {
    constructor() {
        this.client = (0, redis_1.createClient)({
            url: env_config_1.envConfig.REDIS_URL,
            socket: {
                connectTimeout: env_config_1.envConfig.REDIS_CONNECT_TIMEOUT,
                reconnectStrategy: (retries) => {
                    if (retries > env_config_1.envConfig.REDIS_MAX_RETRIES) {
                        logger_1.logger.error('Redis connection failed after max retries');
                        return false;
                    }
                    return Math.min(retries * env_config_1.envConfig.REDIS_RETRY_DELAY, 3000);
                }
            }
        });
        this.client.on('error', (error) => {
            logger_1.logger.error('Redis client error:', error);
        });
        this.client.on('connect', () => {
            logger_1.logger.info('Redis client connected');
        });
        this.client.on('ready', () => {
            logger_1.logger.info('Redis client ready');
        });
        this.client.on('end', () => {
            logger_1.logger.info('Redis client disconnected');
        });
    }
    async connect() {
        try {
            await this.client.connect();
            logger_1.logger.info('Connected to Redis cache');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.disconnect();
            logger_1.logger.info('Disconnected from Redis cache');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }
    async get(key) {
        try {
            return await this.client.get(key);
        }
        catch (error) {
            logger_1.logger.error('Redis GET error:', { key, error });
            return null;
        }
    }
    async set(key, value, ttl) {
        try {
            if (ttl) {
                await this.client.setEx(key, ttl, value);
            }
            else {
                await this.client.set(key, value);
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis SET error:', { key, error });
            return false;
        }
    }
    async del(key) {
        try {
            const result = await this.client.del(key);
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error('Redis DEL error:', { key, error });
            return false;
        }
    }
    async invalidateJobListCaches() {
        try {
            const keys = await this.client.keys(`${CacheService.CACHE_KEYS.JOBS_ALL}:*`);
            const upcomingKeys = await this.client.keys(`${CacheService.CACHE_KEYS.JOBS_UPCOMING}:*`);
            const allKeys = [...keys, ...upcomingKeys];
            if (allKeys.length > 0) {
                await this.client.del(allKeys);
                logger_1.logger.debug(`Invalidated ${allKeys.length} job list cache keys`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to invalidate job list caches:', error);
        }
    }
    async invalidateAllJobCaches(jobId) {
        try {
            const patterns = [
                `${CacheService.CACHE_KEYS.JOB}:*`,
                `${CacheService.CACHE_KEYS.JOBS_ALL}:*`,
                `${CacheService.CACHE_KEYS.JOBS_UPCOMING}:*`,
            ];
            if (jobId) {
                patterns.push(`${CacheService.CACHE_KEYS.DUPLICATE_CHECK}:*`);
            }
            const allKeys = [];
            for (const pattern of patterns) {
                const keys = await this.client.keys(pattern);
                allKeys.push(...keys);
            }
            if (allKeys.length > 0) {
                await this.client.del(allKeys);
                logger_1.logger.debug(`Invalidated ${allKeys.length} cache keys${jobId ? ` for job ${jobId}` : ''}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to invalidate caches:', error);
        }
    }
    getClient() {
        return this.client;
    }
    async ping() {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            logger_1.logger.error('Redis ping failed:', error);
            return false;
        }
    }
}
CacheService.CACHE_KEYS = {
    JOB: 'job',
    JOBS_ALL: 'jobs:all',
    JOBS_UPCOMING: 'jobs:upcoming',
    DUPLICATE_CHECK: 'job:duplicate',
};
exports.cacheService = new CacheService();
