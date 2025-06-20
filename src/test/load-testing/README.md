# Load Testing Suite

This directory contains comprehensive load testing tools to validate our job scheduler's scalability requirements.

## Overview

Our system is designed to handle:
- **6,000 requests/minute** (100 RPS average)
- **12,000 requests/minute** (200 RPS peak capacity)  
- **10,000 concurrent users** globally
- **1,000 services** with individual rate limits

## Test Files

### 1. `smoke-test.yml`
**Purpose**: Quick connectivity and basic functionality test  
**Duration**: 10 seconds  
**Load**: 1 RPS  
**Use Case**: Verify application is running before load testing

```bash
npm run test:load:smoke
# or
npx artillery run src/test/load-testing/smoke-test.yml
```

### 2. `basic-load-test.yml`
**Purpose**: Comprehensive performance validation  
**Duration**: ~5 minutes  
**Load**: 5 → 50 → 100 → 200 → 350 RPS progression  
**Use Case**: Validate target performance requirements

**Test Phases**:
- Warm-up: 5 RPS (30s)
- Baseline: 50 RPS (60s) 
- Target: 100 RPS (120s) ← **Our requirement**
- Peak: 200 RPS (60s) ← **System capacity**
- Burst: 350 RPS (30s) ← **Rate limit validation**

```bash
npm run test:load:basic
# or  
npx artillery run src/test/load-testing/basic-load-test.yml
```

### 3. `rate-limit-test.yml`
**Purpose**: Rate limiting validation and testing  
**Duration**: ~6 minutes  
**Load**: Focused testing of each rate limit layer  
**Use Case**: Verify rate limiting works correctly

**Test Phases**:
- IP rate limiting: 5 → 10 RPS (should trigger at 2 RPS/IP)
- Service rate limiting: 8 → 15 RPS (should trigger at 10 RPS/service)
- Global rate limiting: 150 → 250 RPS (should trigger at 200 RPS total)

```bash
npm run test:load:rate-limits
# or
npx artillery run src/test/load-testing/rate-limit-test.yml
```

### 4. `load-test-runner.js`
**Purpose**: Automated test execution with comprehensive reporting  
**Features**:
- Runs multiple tests in sequence
- Parses Artillery output for metrics
- Generates performance analysis
- Saves detailed results to JSON

```bash
npm run test:load
# or
node src/test/load-testing/load-test-runner.js
```

## Test Scenarios

Each test includes multiple scenarios to simulate real-world usage:

### 1. Health Check Test (10% weight)
- Tests `/health` endpoint
- Should always succeed
- No rate limiting applied

### 2. Rate Limit Stats (5% weight)  
- Tests `/rate-limit-stats` endpoint
- Monitors rate limiting metrics
- Used for system monitoring

### 3. Job Creation - Unique Data (20% weight)
- Tests job creation with unique test data
- Subject to IP rate limiting (120 req/min)
- Simulates basic user traffic

### 4. Job Creation - Different Data (30% weight)
- Tests job creation with varied data patterns
- Subject to IP rate limiting (120 req/min)
- Simulates varied user traffic

### 5. Job Listing (25% weight)
- Tests cached job retrieval
- High-frequency read operations
- Tests cache performance under load

### 6. Job Details (10% weight)
- Tests individual job lookups
- Cache hit/miss behavior
- Database query performance

## Performance Targets

| Metric | Target | How We Test |
|--------|--------|-------------|
| **Throughput** | 100 RPS average | Basic load test @ 100 RPS phase |
| **Peak Capacity** | 200 RPS | Basic load test @ 200 RPS phase |
| **Response Time (p95)** | < 200ms | Monitored across all tests |
| **Response Time (p99)** | < 500ms | Monitored across all tests |
| **Rate Limiting** | Functional | Rate limit test validates all layers |
| **Service Capacity** | 1,000+ requests | Multiple request patterns in tests |

## Expected Results

### Under Normal Load (≤ 100 RPS)
- **Success Rate**: > 99%
- **Response Time p95**: < 200ms
- **Rate Limiting**: Minimal 429 responses
- **Cache Hit Rate**: > 80%

### At Peak Capacity (200 RPS)
- **Success Rate**: > 95%
- **Response Time p95**: < 300ms  
- **Rate Limiting**: Some 429 responses expected
- **System Stability**: No crashes or errors

### Beyond Capacity (> 200 RPS)
- **Success Rate**: > 70% (rate limiting protects system)
- **Rate Limiting**: High 429 response rate expected
- **System Protection**: Rate limiting prevents overload
- **Response Times**: Should remain reasonable for successful requests

## Rate Limiting Validation

### IP Rate Limiting (120 req/min per IP)
- **Expected**: 429 responses when > 2 RPS from single IP
- **Behavior**: All requests are subject to IP-based limiting



### Global Rate Limiting (12,000 req/min total)
- **Expected**: 429 responses when total load > 200 RPS
- **Behavior**: System-wide protection regardless of source

## Running Load Tests

### Prerequisites
1. **Application Running**: Start the application first
   ```bash
   npm run dev
   # or
   npm start
   ```

2. **Dependencies Ready**: PostgreSQL and Redis should be available
3. **Network Access**: Load testing tool needs to reach `localhost:3000`

### Quick Start
```bash
# 1. Smoke test (verify connectivity)
npx artillery run src/test/load-testing/smoke-test.yml

# 2. Basic performance test  
npm run test:load:basic

# 3. Rate limiting validation
npm run test:load:rate-limits

# 4. Full automated suite
npm run test:load
```

### Interpreting Results

#### Success Metrics
- **HTTP 200**: Successful requests
- **HTTP 201**: Successful job creation  
- **HTTP 429**: Rate limiting (expected under high load)

#### Performance Metrics
- **Response Time**: Time to complete request
- **Throughput**: Requests per second achieved
- **Success Rate**: Percentage of non-error responses

#### Rate Limiting Metrics  
- **Rate Limit Hits**: Number of 429 responses by type
- **Retry After**: Suggested wait time for rate limited requests

## Troubleshooting

### Common Issues

1. **Connection Refused**: Application not running
   ```bash
   # Start the application first
   npm run dev
   ```

2. **Database Errors**: PostgreSQL not available
   ```bash
   # Check database connection in .env
   # Ensure PostgreSQL is running
   ```

3. **High Error Rates**: System overloaded
   ```bash
   # Reduce load or increase system resources
   # Check if rate limiting is working correctly
   ```

4. **Test Timeout**: System too slow
   ```bash
   # Check system resources (CPU, memory)
   # Verify database and Redis performance
   ```

## Customization

### Modify Test Parameters
Edit YAML files to adjust:
- `arrivalRate`: Requests per second
- `duration`: Test phase length  
- `phases`: Test progression
- `scenarios`: Mix of request types

### Add New Scenarios
Add new test scenarios to YAML files:
```yaml
scenarios:
  - name: 'Custom Test'
    weight: 10
    flow:
      - get:
          url: '/custom-endpoint'
          expect:
            - statusCode: 200
```

### Custom Metrics
Modify `load-test-runner.js` to add custom performance analysis and reporting.

## Results Storage

Load test results are automatically saved to:
- `src/test/load-testing/results/load-test-results-{timestamp}.json`

Each result file contains:
- Test execution details
- Raw Artillery output  
- Performance metrics
- Error analysis 