"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvenRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const cache_service_1 = require("../services/cache.service");
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
// Proven Redis-backed rate limiter using express-rate-limit + rate-limit-redis
class ProvenRateLimiter {
    static async initialize() {
        try {
            const redisClient = cache_service_1.cacheService.getClient();
            if (!redisClient) {
                throw new Error('Redis client not available for rate limiting');
            }
            const store = new rate_limit_redis_1.default({
                sendCommand: (...args) => redisClient.sendCommand(args),
            });
            ProvenRateLimiter.rateLimiter = (0, express_rate_limit_1.default)({
                store,
                windowMs: env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS,
                max: env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
                message: {
                    error: 'Too many requests from this IP',
                    retryAfter: Math.ceil(env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000),
                    limit: env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
                    windowMs: env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS,
                    rateLimitType: 'ip'
                },
                standardHeaders: true,
                legacyHeaders: false,
                keyGenerator: (req) => {
                    const forwarded = req.headers['x-forwarded-for'];
                    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
                    return `ip:${ip}`;
                },
                skip: (req) => {
                    return false;
                },
                handler: (req, res) => {
                    const ip = req.headers['x-forwarded-for'] || req.ip;
                    logger_1.logger.warn('IP rate limit exceeded', {
                        ip,
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent']
                    });
                    res.status(429).json({
                        error: 'Too many requests from this IP',
                        retryAfter: Math.ceil(env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000),
                        limit: env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
                        windowMs: env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS,
                        rateLimitType: 'ip'
                    });
                }
            });
            ProvenRateLimiter.initialized = true;
            logger_1.logger.info('Proven rate limiter initialized with express-rate-limit + Redis store');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize proven rate limiter:', error);
            throw error;
        }
    }
    static isInitialized() {
        return ProvenRateLimiter.initialized;
    }
    // Middleware getter
    static get middleware() {
        if (!ProvenRateLimiter.initialized) {
            throw new Error('Rate limiter not initialized. Call initialize() first.');
        }
        return ProvenRateLimiter.rateLimiter;
    }
    // Statistics method for monitoring
    static async getStatistics() {
        try {
            const redisClient = cache_service_1.cacheService.getClient();
            if (!redisClient) {
                return { error: 'Redis client not available' };
            }
            const keys = await redisClient.keys('rl:*');
            const totalActiveKeys = keys.length;
            return {
                totalActiveConnections: totalActiveKeys,
                windowMs: env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS,
                maxRequestsPerWindow: env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS,
                maxRPS: Math.round(env_config_1.envConfig.RATE_LIMIT_IP_MAX_REQUESTS / (env_config_1.envConfig.RATE_LIMIT_IP_WINDOW_MS / 1000)),
                activeIPs: totalActiveKeys,
                rateLimitingEnabled: ProvenRateLimiter.initialized
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get rate limit statistics:', error);
            return { error: 'Failed to retrieve statistics' };
        }
    }
}
exports.ProvenRateLimiter = ProvenRateLimiter;
ProvenRateLimiter.initialized = false;
