import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete within 500ms
    errors: ['rate<0.05'],              // Error rate must be less than 5%
    'response_time': ['p(99)<1000'],    // 99th percentile response time < 1s
  },
};

// Test setup
export function setup() {
  console.log('Starting Prism performance tests...');
  return { startTime: Date.now() };
}

// Main test function
export default function(data) {
  // Test 1: Root endpoint (load balancer)
  const rootRes = http.get('http://localhost:80/');
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
    'root has service field': (r) => r.json().hasOwnProperty('service'),
  });
  responseTime.add(rootRes.timings.duration);
  errorRate.add(rootRes.status !== 200);

  // Test 2: Service A health endpoint
  const healthARes = http.get('http://localhost:80/api/v1/health');
  check(healthARes, {
    'service A health is 200': (r) => r.status === 200,
    'service A is healthy': (r) => r.json().status === 'healthy',
  });

  // Test 3: Service B health endpoint
  const healthBRes = http.get('http://localhost:80/api/v2/health');
  check(healthBRes, {
    'service B health is 200': (r) => r.status === 200,
    'service B is healthy': (r) => r.json().status === 'healthy',
  });

  // Test 4: Cross-service communication
  const crossRes = http.get('http://localhost:80/api/v2/query-service-a');
  check(crossRes, {
    'cross-service communication works': (r) => r.status === 200,
  });

  // Test 5: Metrics endpoints
  const metricsARes = http.get('http://localhost:80/api/v1/metrics');
  check(metricsARes, {
    'service A metrics available': (r) => r.status === 200,
  });

  const metricsBRes = http.get('http://localhost:80/api/v2/metrics');
  check(metricsBRes, {
    'service B metrics available': (r) => r.status === 200,
  });

  // Test 6: Batch endpoint
  const batchPayload = JSON.stringify({
    items: ['item1', 'item2', 'item3', 'item4', 'item5']
  });

  const batchRes = http.post('http://localhost:80/api/v2/batch', batchPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(batchRes, {
    'batch endpoint works': (r) => r.status === 200,
    'batch processes all items': (r) => r.json().batchSize === 5,
  });

  // Simulate realistic user behavior
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Performance tests completed in ${duration}s`);

  // Generate summary
  console.log('\n=== Test Summary ===');
  console.log(`Total requests: ${__ITER}`);
  console.log(`Error rate: ${errorRate.value}`);
  console.log(`Avg response time: ${responseTime.avg}ms`);
}

