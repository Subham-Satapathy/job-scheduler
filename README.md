# Job Scheduler Microservice

A scalable job scheduler microservice built with Node.js, TypeScript, and BullMQ.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Load Testing](#load-testing)
- [Performance Targets](#performance-targets)
- [Architecture](#architecture)
- [Development](#development)
- [Testing](#testing)
- [Docker](#docker)
- [Contributing](#contributing)

## Features

- **Enhanced Rate Limiting**: Multi-layer rate limiting supporting 100+ RPS with service-specific quotas
- **Job Scheduling**: Support for one-time and recurring jobs with cron expressions
- **Job Management**: Create, update, delete, and monitor jobs
- **Job Enable/Disable**: Enable or disable jobs without deletion, with automatic queue management
- **Caching**: Redis-based caching for improved performance
- **Scalable Architecture**: Designed to handle 10,000+ users and 1,000+ services

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis configuration

# Run database migrations
npm run db:push

# Build the application
npm run build

# Start the application
npm start
```

### Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Run load tests
npm run test:load
```

## API Documentation

### Job Management

#### Create a Job

```bash
POST /jobs
Content-Type: application/json

{
  "name": "Example Job",
  "description": "Job description",
  "enabled": true,
  "frequency": "DAILY",
  "startDate": "2024-01-01T00:00:00Z",
  "data": { "key": "value" }
}
```

#### Get All Jobs

```bash
GET /jobs?page=1&limit=10&status=PENDING
```

#### Get Job by ID

```bash
GET /jobs/:id
```

#### Update Job

```bash
PUT /jobs/:id
```

#### Delete Job

```bash
DELETE /jobs/:id
```

#### Enable Job

```bash
PATCH /jobs/:id/enable
```

#### Disable Job

```bash
PATCH /jobs/:id/disable
```

### Job Enable/Disable Feature

The Job Scheduler supports enabling and disabling jobs without deletion, providing flexible job lifecycle management:

#### Features

- **Non-destructive**: Disabling a job preserves all job data and configuration
- **Automatic Queue Management**: Disabled jobs are automatically removed from execution queue
- **Instant Scheduling**: Enabling a pending job immediately schedules it for execution
- **Safety Checks**: Workers double-check enabled status before job execution
- **Comprehensive Logging**: All enable/disable operations are logged for debugging

#### Usage Examples

```bash
# Create a job (enabled by default)
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Processing Job",
    "description": "Process daily data",
    "enabled": true,
    "frequency": "DAILY",
    "startDate": "2024-12-20T09:00:00.000Z",
    "data": {"source": "database"}
  }'

# Disable a job (removes from queue, keeps data)
curl -X PATCH http://localhost:3000/jobs/1/disable

# Enable a job (schedules for execution)
curl -X PATCH http://localhost:3000/jobs/1/enable

# Check job status
curl -X GET http://localhost:3000/jobs/1
```

#### Benefits

- **Resource Management**: Temporarily disable resource-intensive jobs during peak hours
- **Maintenance Windows**: Disable jobs during system maintenance without losing configuration
- **Debugging**: Disable problematic jobs for investigation while preserving settings
- **Feature Rollouts**: Gradually enable jobs across different environments

### Health & Statistics

```bash
# Health check
GET /health

# Rate limiting statistics
GET /rate-limit-stats
```

### Rate Limiting Configuration

The rate limiting system provides IP-based protection to prevent abuse:

- **IP Rate Limiting**: 120 requests/minute per IP address (2 RPS per IP)

Configure via environment variables:

```bash
# IP limits (per user)
RATE_LIMIT_IP_WINDOW_MS=60000            # 1 minute
RATE_LIMIT_IP_MAX_REQUESTS=120           # 2 RPS per IP
```

Check rate limiting statistics:

```bash
curl http://localhost:3000/rate-limit-stats
```

Response includes:
- Current IP-based rate limiting configuration
- Real-time statistics from the rate limiter

## Load Testing

### Overview

Our system is designed to handle:
- **6,000 requests/minute** (100 RPS average)
- **12,000 requests/minute** (200 RPS peak capacity)
- **10,000 concurrent users** globally
- **1,000 services** with individual rate limits

### Load Testing Commands

```bash
# Run comprehensive load testing suite
npm run test:load

# Run basic load test (tests target RPS)
npm run test:load:basic

# Run rate limiting specific tests
npm run test:load:rate-limits

# Run all tests (unit + load tests)
npm run test:all

# Smoke test (quick connectivity check)
npm run test:load:smoke
```

### Test Files

#### 1. Smoke Test
- **Purpose**: Quick connectivity and basic functionality test
- **Duration**: 10 seconds
- **Load**: 1 RPS
- **Use Case**: Verify application is running before load testing

#### 2. Basic Load Test
- **Purpose**: Comprehensive performance validation
- **Duration**: ~5 minutes
- **Load**: 5 → 50 → 100 → 200 → 350 RPS progression
- **Use Case**: Validate target performance requirements

**Test Phases**:
- Warm-up: 5 RPS (30s)
- Baseline: 50 RPS (60s)
- Target: 100 RPS (120s) - Our requirement
- Peak: 200 RPS (60s) - System capacity
- Burst: 350 RPS (30s) - Rate limit validation

#### 3. Rate Limit Test
- **Purpose**: Rate limiting validation and testing
- **Duration**: ~6 minutes
- **Load**: Focused testing of each rate limit layer
- **Use Case**: Verify rate limiting works correctly

**Test Phases**:
- IP rate limiting: 5 → 10 RPS (should trigger at 2 RPS/IP)
- Service rate limiting: 8 → 15 RPS (should trigger at 10 RPS/service)
- Global rate limiting: 150 → 250 RPS (should trigger at 200 RPS total)

### Test Scenarios

Each test includes multiple scenarios to simulate real-world usage:

1. **Health Check Test** (10% weight)
   - Tests `/health` endpoint
   - Should always succeed
   - No rate limiting applied

2. **Rate Limit Stats** (5% weight)
   - Tests `/rate-limit-stats` endpoint
   - Monitors rate limiting metrics
   - Used for system monitoring

3. **Job Creation - Unique Data** (20% weight)
   - Tests job creation with unique test data
   - Subject to IP rate limiting (120 req/min)
   - Simulates basic user traffic

4. **Job Creation - Different Data** (30% weight)
   - Tests job creation with varied data patterns
   - Subject to IP rate limiting (120 req/min)
   - Simulates varied user traffic

5. **Job Listing** (25% weight)
   - Tests cached job retrieval
   - High-frequency read operations
   - Tests cache performance under load

6. **Job Details** (10% weight)
   - Tests individual job lookups
   - Cache hit/miss behavior
   - Database query performance

### Expected Results

#### Under Normal Load (≤ 100 RPS)
- **Success Rate**: > 99%
- **Response Time p95**: < 200ms
- **Rate Limiting**: Minimal 429 responses
- **Cache Hit Rate**: > 80%

#### At Peak Capacity (200 RPS)
- **Success Rate**: > 95%
- **Response Time p95**: < 300ms
- **Rate Limiting**: Some 429 responses expected
- **System Stability**: No crashes or errors

#### Beyond Capacity (> 200 RPS)
- **Success Rate**: > 70% (rate limiting protects system)
- **Rate Limiting**: High 429 response rate expected
- **System Protection**: Rate limiting prevents overload
- **Response Times**: Should remain reasonable for successful requests

### Running Load Tests

#### Prerequisites
1. **Application Running**: Start the application first
   ```bash
   npm run dev
   # or
   npm start
   ```

2. **Dependencies Ready**: PostgreSQL and Redis should be available
3. **Network Access**: Load testing tool needs to reach `localhost:3000`

#### Interpreting Results

**Success Metrics**:
- **HTTP 200**: Successful requests
- **HTTP 201**: Successful job creation
- **HTTP 429**: Rate limiting (expected under high load)

**Performance Metrics**:
- **Response Time**: Time to complete request
- **Throughput**: Requests per second achieved
- **Success Rate**: Percentage of non-error responses

**Rate Limiting Metrics**:
- **Rate Limit Hits**: Number of 429 responses by type
- **Retry After**: Suggested wait time for rate limited requests

## Performance Targets

Our load testing validates these performance targets:

| Metric | Target | Notes |
|--------|--------|-------|
| Throughput | 100 RPS average | 6,000 requests/minute |
| Peak Capacity | 200 RPS | 12,000 requests/minute |
| Response Time (p95) | < 200ms | 95% of requests |
| Response Time (p99) | < 500ms | 99% of requests |
| Availability | 99.9% | < 8.77 hours downtime/year |
| Concurrent Users | 10,000+ | Global distribution |
| Services Supported | 1,000+ | Individual rate limits |

### Scalability Features

#### Rate Limiting
- **IP-based Protection**: Per-IP rate limiting to prevent abuse
- **Fail-open Design**: Rate limiting failures don't break core functionality
- **Redis-backed**: Distributed rate limiting with sliding windows

#### Caching
- **Multi-level Caching**: Application and Redis caching layers
- **Intelligent TTL**: Optimized cache expiration times
- **Cache Invalidation**: Automatic cache updates on data changes

#### Health & Observability
- **Health Checks**: Application and dependency health monitoring
- **Rate Limit Statistics**: Real-time rate limiting analytics

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   Load Balancer │────│  Application │────│  PostgreSQL │
└─────────────────┘    └──────────────┘    └─────────────┘
                              │
                              │
                       ┌──────────────┐    ┌─────────────┐
                       │    Redis     │────│   BullMQ    │
                       │   (Cache)    │    │  Workers    │
                       └──────────────┘    └─────────────┘
```

## Development

### Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── db/             # Database schema and connection
├── middleware/     # Express middleware (including rate limiting)
├── routes/         # API route definitions
├── services/       # Business logic
├── test/           # Tests and load testing
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── validation/     # Request validation
└── workers/        # Background job workers
```

## Testing

### Unit Tests

```bash
# Run unit tests
npm test

# Watch mode for development
npm run test:watch
```

### Load Testing

```bash
# Full automated suite
npm run test:load

# Specific test types
npm run test:load:basic
npm run test:load:rate-limits
npm run test:load:smoke

# All tests (unit + load)
npm run test:all
```

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm run test:all` to ensure all tests pass
6. Submit a pull request

## License

ISC License 
ISC License 