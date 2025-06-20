"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = void 0;
const prom_client_1 = require("prom-client");
const logger_1 = require("../utils/logger");
const env_config_1 = require("../config/env.config");
class MonitoringService {
    constructor() {
        // Job metrics
        this.jobExecutionDuration = new prom_client_1.Histogram({
            name: 'job_execution_duration_seconds',
            help: 'Duration of job execution in seconds',
            labelNames: ['job_type', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
        });
        this.jobSuccessCounter = new prom_client_1.Counter({
            name: 'jobs_completed_total',
            help: 'Total number of completed jobs',
            labelNames: ['job_type']
        });
        this.jobFailureCounter = new prom_client_1.Counter({
            name: 'jobs_failed_total',
            help: 'Total number of failed jobs',
            labelNames: ['job_type', 'error_type']
        });
        this.activeJobsGauge = new prom_client_1.Gauge({
            name: 'active_jobs_current',
            help: 'Current number of active jobs',
            labelNames: ['job_type']
        });
        this.queueSizeGauge = new prom_client_1.Gauge({
            name: 'job_queue_size_current',
            help: 'Current size of job queue',
            labelNames: ['queue_name']
        });
        // Database performance metrics
        this.dbConnectionPoolSize = new prom_client_1.Gauge({
            name: 'db_connection_pool_size_total',
            help: 'Total size of database connection pool',
            labelNames: ['pool_type']
        });
        this.dbConnectionPoolUsed = new prom_client_1.Gauge({
            name: 'db_connection_pool_used_current',
            help: 'Currently used database connections',
            labelNames: ['pool_type']
        });
        this.dbConnectionPoolIdle = new prom_client_1.Gauge({
            name: 'db_connection_pool_idle_current',
            help: 'Currently idle database connections',
            labelNames: ['pool_type']
        });
        this.dbQueryDuration = new prom_client_1.Histogram({
            name: 'db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['query_type', 'table', 'operation'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
        });
        this.dbQueryCounter = new prom_client_1.Counter({
            name: 'db_queries_total',
            help: 'Total number of database queries',
            labelNames: ['query_type', 'table', 'operation', 'status']
        });
        this.dbErrorCounter = new prom_client_1.Counter({
            name: 'db_errors_total',
            help: 'Total number of database errors',
            labelNames: ['error_type', 'operation']
        });
        this.dbConnectionAttempts = new prom_client_1.Counter({
            name: 'db_connection_attempts_total',
            help: 'Total number of database connection attempts',
            labelNames: ['pool_type']
        });
        this.dbConnectionFailures = new prom_client_1.Counter({
            name: 'db_connection_failures_total',
            help: 'Total number of database connection failures',
            labelNames: ['pool_type', 'error_type']
        });
        // Duplicate prevention metrics
        this.duplicateCheckDuration = new prom_client_1.Histogram({
            name: 'duplicate_check_duration_seconds',
            help: 'Duration of duplicate check operations in seconds',
            labelNames: ['check_type', 'result'],
            buckets: [0.001, 0.002, 0.003, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
        });
        this.duplicateCheckCounter = new prom_client_1.Counter({
            name: 'duplicate_checks_total',
            help: 'Total number of duplicate check operations',
            labelNames: ['check_type', 'result', 'source']
        });
        this.duplicateDetectedCounter = new prom_client_1.Counter({
            name: 'duplicates_detected_total',
            help: 'Total number of duplicate jobs detected and prevented',
            labelNames: ['job_frequency', 'detection_method']
        });
        this.duplicateCacheHitCounter = new prom_client_1.Counter({
            name: 'duplicate_cache_hits_total',
            help: 'Total number of duplicate check cache hits',
            labelNames: ['cache_type']
        });
        logger_1.logger.info('Enhanced monitoring service initialized with database and duplicate prevention metrics');
    }
    static getInstance() {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }
    // Job monitoring methods
    recordJobExecution(jobType, duration, status) {
        this.jobExecutionDuration.observe({ job_type: jobType, status }, duration);
        if (status === 'success') {
            this.jobSuccessCounter.inc({ job_type: jobType });
        }
    }
    recordJobFailure(jobType, errorType) {
        this.jobFailureCounter.inc({ job_type: jobType, error_type: errorType });
    }
    setActiveJobs(jobType, count) {
        this.activeJobsGauge.set({ job_type: jobType }, count);
    }
    setQueueSize(queueName, size) {
        this.queueSizeGauge.set({ queue_name: queueName }, size);
    }
    // Enhanced database monitoring methods
    recordDatabaseQuery(queryType, table, operation, duration, status = 'success') {
        this.dbQueryDuration.observe({ query_type: queryType, table, operation }, duration);
        this.dbQueryCounter.inc({ query_type: queryType, table, operation, status });
    }
    recordDatabaseError(errorType, operation) {
        this.dbErrorCounter.inc({ error_type: errorType, operation });
    }
    updateConnectionPoolMetrics(poolType, total, used, idle) {
        this.dbConnectionPoolSize.set({ pool_type: poolType }, total);
        this.dbConnectionPoolUsed.set({ pool_type: poolType }, used);
        this.dbConnectionPoolIdle.set({ pool_type: poolType }, idle);
    }
    recordConnectionAttempt(poolType) {
        this.dbConnectionAttempts.inc({ pool_type: poolType });
    }
    recordConnectionFailure(poolType, errorType) {
        this.dbConnectionFailures.inc({ pool_type: poolType, error_type: errorType });
    }
    // Duplicate prevention monitoring methods
    recordDuplicateCheck(checkType, result, source, duration) {
        this.duplicateCheckDuration.observe({ check_type: checkType, result }, duration);
        this.duplicateCheckCounter.inc({ check_type: checkType, result, source });
    }
    recordDuplicateDetected(jobFrequency, detectionMethod) {
        this.duplicateDetectedCounter.inc({ job_frequency: jobFrequency, detection_method: detectionMethod });
    }
    recordDuplicateCacheHit(cacheType) {
        this.duplicateCacheHitCounter.inc({ cache_type: cacheType });
    }
    // Get duplicate prevention statistics
    getDuplicatePreventionStats() {
        // Note: In a real implementation, you'd query the metrics registry
        // This is a simplified version for demonstration
        return {
            totalChecks: 0, // Would be calculated from metric registry
            duplicatesDetected: 0,
            cacheHitRate: 0.0,
            averageCheckDuration: 0.0
        };
    }
    // Database health monitoring
    async monitorDatabaseHealth() {
        try {
            // Record current connection pool configuration
            this.updateConnectionPoolMetrics('primary', env_config_1.envConfig.DB_POOL_MAX, 0, // This would be updated by actual pool monitoring
            env_config_1.envConfig.DB_POOL_MIN);
            logger_1.logger.debug('Database health monitoring updated', {
                maxConnections: env_config_1.envConfig.DB_POOL_MAX,
                minConnections: env_config_1.envConfig.DB_POOL_MIN,
                idleTimeout: env_config_1.envConfig.DB_POOL_IDLE_TIMEOUT,
                queryTimeout: env_config_1.envConfig.DB_QUERY_TIMEOUT
            });
        }
        catch (error) {
            logger_1.logger.error('Database health monitoring failed:', error);
            this.recordDatabaseError('health_check_failed', 'monitor');
        }
    }
    // Performance analysis methods
    getDatabasePerformanceMetrics() {
        return {
            connectionPoolSize: env_config_1.envConfig.DB_POOL_MAX,
            queryTimeoutMs: env_config_1.envConfig.DB_QUERY_TIMEOUT,
            connectionTimeoutMs: env_config_1.envConfig.DB_POOL_CONNECT_TIMEOUT,
            preparedStatements: env_config_1.envConfig.DB_ENABLE_PREPARED_STATEMENTS
        };
    }
    async getPrometheusMetrics() {
        return prom_client_1.register.metrics();
    }
}
exports.monitoringService = MonitoringService.getInstance();
