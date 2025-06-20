#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LoadTestRunner {
  constructor() {
    this.testResults = {};
    this.testConfigs = [
      { name: 'Smoke Test', file: 'smoke-test.yml' },
      { name: 'Basic Load Test', file: 'basic-load-test.yml' },
      { name: 'Rate Limit Functionality Test', file: 'rate-limit-test.yml' },
      { name: 'Database Performance Test', file: 'database-performance-test.yml' }
    ];
  }

  async runTest(testName, configFile) {
    console.log(`\nRunning ${testName}...`);
    
    return new Promise((resolve) => {
      const testPath = path.join(__dirname, configFile);
      const startTime = Date.now();
      
      const artillery = spawn('npx', ['artillery', 'run', testPath], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      artillery.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      artillery.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      artillery.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          console.log(`${testName} completed successfully in ${duration}ms`);
          resolve({
            success: true,
            output: stdout,
            duration,
            exitCode: code
          });
        } else {
          console.log(`${testName} failed with exit code ${code}`);
          resolve({
            success: false,
            output: stdout,
            errorOutput: stderr,
            duration,
            exitCode: code
          });
        }
      });
    });
  }

  parseArtilleryOutput(output) {
    const metrics = {};
    
    try {
      const lines = output.split('\n');
      
      for (const line of lines) {
        if (line.includes('Response time')) {
          const medianMatch = line.match(/median:\s*(\d+(?:\.\d+)?)/);
          const p95Match = line.match(/p95:\s*(\d+(?:\.\d+)?)/);
          const p99Match = line.match(/p99:\s*(\d+(?:\.\d+)?)/);
          
          if (medianMatch || p95Match || p99Match) {
            metrics.responseTime = {
              median: medianMatch ? parseFloat(medianMatch[1]) : null,
              p95: p95Match ? parseFloat(p95Match[1]) : null,
              p99: p99Match ? parseFloat(p99Match[1]) : null
            };
          }
        }
        
        if (line.includes('http.codes')) {
          const statusMatch = line.match(/http\.codes\.(\d+):\s*(\d+)/);
          if (statusMatch) {
            if (!metrics.statusCodes) metrics.statusCodes = {};
            metrics.statusCodes[statusMatch[1]] = parseInt(statusMatch[2]);
          }
        }
        
        if (line.includes('http.requests:')) {
          const requestMatch = line.match(/http\.requests:\s*(\d+)/);
          if (requestMatch) {
            metrics.totalRequests = parseInt(requestMatch[1]);
          }
        }
        
        if (line.includes('Rate limited')) {
          const limitMatch = line.match(/Rate limited \((\w+)\):\s*(\d+)/);
          if (limitMatch) {
            if (!metrics.rateLimitHits) metrics.rateLimitHits = {};
            metrics.rateLimitHits[limitMatch[1]] = parseInt(limitMatch[2]);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse some metrics:', error.message);
    }
    
    return metrics;
  }

  generateReport() {
    console.log('\nLOAD TESTING REPORT');
    console.log('='.repeat(50));

    const totalTests = this.testConfigs.length;
    const successfulTests = Object.values(this.testResults).filter(r => r.success).length;
    
    console.log(`Test success rate: ${successfulTests}/${totalTests} (${Math.round(successfulTests/totalTests*100)}%)`);
    console.log('');

    for (const testName in this.testResults) {
      console.log(`${testName}`);
      const result = this.testResults[testName];
      console.log(`   Status: ${result.success ? 'PASSED' : 'FAILED'}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Exit Code: ${result.exitCode}`);
      
      if (result.success && result.output) {
        const metrics = this.parseArtilleryOutput(result.output);
        
        if (metrics.responseTime) {
          console.log(`   Response Times:`);
          console.log(`     - Median: ${metrics.responseTime.median}ms`);
          console.log(`     - 95th percentile: ${metrics.responseTime.p95}ms`);
          console.log(`     - 99th percentile: ${metrics.responseTime.p99}ms`);
        }
        
        if (metrics.statusCodes) {
          console.log(`   HTTP Status Codes:`);
          for (const [code, count] of Object.entries(metrics.statusCodes)) {
            const status = code.startsWith('2') ? 'SUCCESS' : code === '429' ? 'RATE LIMITED' : 'ERROR';
            console.log(`     - ${code}: ${count} [${status}]`);
          }
        }
        
        if (metrics.totalRequests) {
          const rps = Math.round(metrics.totalRequests / (result.duration / 1000));
          console.log(`   Total Requests: ${metrics.totalRequests} (${rps} RPS)`);
        }
        
        if (metrics.rateLimitHits) {
          console.log(`   Rate Limit Hits:`);
          for (const [type, count] of Object.entries(metrics.rateLimitHits)) {
            console.log(`     - ${type}: ${count}`);
          }
        }
      }
      
      if (!result.success && result.errorOutput) {
        console.log(`   Error: ${result.errorOutput.substring(0, 200)}...`);
      }
    }

    this.generateRecommendations();
  }

  generateRecommendations() {
    console.log('\nPERFORMANCE ANALYSIS & RECOMMENDATIONS');
    console.log('='.repeat(50));

    const hasRateLimitTest = this.testResults['Rate Limit Functionality Test'];
    if (hasRateLimitTest && hasRateLimitTest.success) {
      console.log('Rate limiting system is functional');
      
      const metrics = this.parseArtilleryOutput(hasRateLimitTest.output);
      if (metrics.statusCodes) {
        const total = Object.values(metrics.statusCodes).reduce((a, b) => a + b, 0);
        const rateLimited = metrics.statusCodes['429'] || 0;
        const successRate = ((total - rateLimited) / total * 100).toFixed(1);
        
        console.log(`Success rate under load: ${successRate}%`);
        
        if (successRate > 95) {
          console.log('Excellent performance - system handling load well');
        } else if (successRate > 85) {
          console.log('Good performance - some rate limiting occurring as expected');
        } else {
          console.log('Poor performance - investigate rate limiting configuration');
        }
      }
    }

    console.log('\nTARGET PERFORMANCE VALIDATION:');
    console.log('   Target: 6,000 requests/minute (100 RPS average)');
    console.log('   Peak Capacity: 12,000 requests/minute (200 RPS)');
    
    const basicLoadTest = this.testResults['Basic Load Test'];
    if (basicLoadTest && basicLoadTest.success) {
      const metrics = this.parseArtilleryOutput(basicLoadTest.output);
      if (metrics.responseTime) {
        if (metrics.responseTime.p95 < 200) {
          console.log('Response time target met (p95 < 200ms)');
        } else {
          console.log(`Response time target missed (p95: ${metrics.responseTime.p95}ms > 200ms)`);
        }
      }
    }

    console.log('\nNEXT STEPS:');
    console.log('1. Review failed tests for specific error patterns');
    console.log('2. Monitor response times under sustained load');
    console.log('3. Validate rate limiting effectiveness');
    console.log('4. Check database performance under concurrent operations');
    console.log('5. Consider horizontal scaling if approaching limits');

    console.log('\nLOAD TESTING PERFORMANCE TARGETS:');
    console.log('- Response Time (p95): < 200ms');
    console.log('- Response Time (p99): < 500ms');  
    console.log('- Success Rate: > 95% (excluding rate limited requests)');
    console.log('- Rate Limiting: Should activate when thresholds exceeded');
    console.log('- Database Operations: Should maintain < 100ms query times');
    console.log('- Memory Usage: Should remain stable during load');
    console.log('- Error Rate: < 1% for legitimate requests');

    console.log('\nSCALABILITY VALIDATION:');
    console.log('Current system should handle:');
    console.log('- 10,000 concurrent users globally'); 
    console.log('- 1,000 services with individual rate limits');
    console.log('- 6,000 API requests per minute sustained load');
    console.log('Target: 100 RPS average, 200 RPS peak');
    console.log('');
    console.log('If targets are not met, consider:');
    console.log('- Database connection pooling optimization');
    console.log('- Redis cluster implementation');
    console.log('- Horizontal application scaling');
    console.log('- CDN implementation for static content');
    console.log('- Database read replicas');
    console.log('- Caching layer enhancements');
    console.log('');
    console.log('For production deployment:');
    console.log('- Enable monitoring and alerting');
    console.log('- Implement health checks');
    console.log('- Configure log aggregation');
    console.log('- Set up backup and recovery procedures');
    console.log('- Establish incident response procedures');
    console.log('');
    console.log('Load testing complete!');
  }

  async runAllTests() {
    console.log('Starting comprehensive load testing suite...');
    console.log('This will validate system performance under various load conditions.');
    console.log('');

    for (const config of this.testConfigs) {
      try {
        const result = await this.runTest(config.name, config.file);
        this.testResults[config.name] = result;
      } catch (error) {
        console.error(`Failed to run ${config.name}:`, error);
        this.testResults[config.name] = {
          success: false,
          error: error.message,
          duration: 0,
          exitCode: -1
        };
      }
    }

    this.generateReport();
  }
}

if (require.main === module) {
  const runner = new LoadTestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = LoadTestRunner; 