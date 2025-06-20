# Job Scheduler Microservice

A scalable job scheduler microservice built with Node.js, TypeScript, and BullMQ.

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

## Load Testing & Performance

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

### Monitoring Rate Limits

Check rate limiting statistics:
```bash
curl http://localhost:3000/rate-limit-stats
```

Response includes:
- Current IP-based rate limiting configuration
- Real-time statistics from the rate limiter

## API Endpoints

### Job Management

```bash
# Create a job
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

# Get all jobs
GET /jobs?page=1&limit=10&status=PENDING

# Get job by ID
GET /jobs/:id

# Update job
PUT /jobs/:id

# Delete job
DELETE /jobs/:id

# Enable a job (schedules it for execution)
PATCH /jobs/:id/enable

# Disable a job (removes from queue, but keeps job data)
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

## Scalability Features

### Rate Limiting
- **IP-based Protection**: Per-IP rate limiting to prevent abuse
- **Fail-open Design**: Rate limiting failures don't break core functionality
- **Redis-backed**: Distributed rate limiting with sliding windows

### Caching
- **Multi-level Caching**: Application and Redis caching layers
- **Intelligent TTL**: Optimized cache expiration times
- **Cache Invalidation**: Automatic cache updates on data changes

### Health & Observability
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

### Testing

```bash
# Unit tests
npm test

# Load testing (requires running application)
npm run test:load

# Watch mode for development
npm run test:watch
```

### Docker

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