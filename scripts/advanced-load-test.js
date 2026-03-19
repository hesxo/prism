import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');

// Load test scenarios
export const options = {
  scenarios: {
    // Normal load scenario
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 20 },  // Stay at 20 users
        { duration: '2m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 50 },  // Stay at 50 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
    },
    
    // Spike test scenario
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },    // Normal load
        { duration: '30s', target: 200 },  // Spike to 200 users
        { duration: '1m', target: 200 },   // Stay at spike
        { duration: '30s', target: 10 },   // Drop back down
        { duration: '1m', target: 10 },    // Recover
      ],
      startTime: '15m',  // Start after normal load
      gracefulRampDown: '30s',
    },
    
    // Stress test scenario
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp to 50
        { duration: '2m', target: 100 },  // Ramp to 100
        { duration: '2m', target: 150 },  // Ramp to 150
        { duration: '2m', target: 200 },  // Ramp to 200
        { duration: '2m', target: 250 },  // Ramp to 250
        { duration: '5m', target: 250 },  // Stay at 250
        { duration: '5m', target: 0 },    // Ramp down
      ],
      startTime: '25m',
      gracefulRampDown: '1m',
    },
    
    // Soak test (long duration)
    soak_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1h',
      startTime: '40m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
    'response_time': ['p(99)<1500'],
  },
};

// Test setup
export function setup() {
  console.log('Starting advanced load tests...');
  
  // Verify system is healthy
  const healthCheck = http.get('http://localhost/health');
  check(healthCheck, {
    'system is healthy': (r) => r.status === 200,
  });
  
  return {
    startTime: Date.now(),
    testId: `load-test-${Date.now()}`,
  };
}

// Test functions
function testRootEndpoint() {
  const res = http.get('http://localhost/');
  const success = check(res, {
    'root status is 200': (r) => r.status === 200,
  });
  
  responseTime.add(res.timings.duration);
  if (success) {
    successfulRequests.add(1);
  } else {
    errorRate.add(1);
  }
  
  return res;
}

function testServiceA() {
  const res = http.get('http://localhost/api/v1/');
  check(res, {
    'service A status is 200': (r) => r.status === 200,
    'service A returns red': (r) => r.json().color === 'red',
  });
}

function testServiceB() {
  const res = http.get('http://localhost/api/v2/');
  check(res, {
    'service B status is 200': (r) => r.status === 200,
    'service B returns blue': (r) => r.json().color === 'blue',
  });
}

function testCrossService() {
  const res = http.get('http://localhost/api/v2/query-service-a');
  check(res, {
    'cross-service works': (r) => r.status === 200,
  });
}

function testBatchEndpoint() {
  const payload = JSON.stringify({
    items: Array.from({ length: 10 }, (_, i) => `item-${i}`)
  });
  
  const res = http.post('http://localhost/api/v2/batch', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'batch endpoint works': (r) => r.status === 200,
    'batch processes all items': (r) => r.json().batchSize === 10,
  });
}

function testChaosMode() {
  // Test with chaos headers to trigger specific behaviors
  const chaosHeaders = {
    'x-chaos-delay': Math.random() > 0.7 ? '1000' : '0',
    'x-chaos-error': Math.random() > 0.9 ? 'true' : 'false',
  };
  
  const res = http.get('http://localhost/api/v1/echo/test', {
    headers: chaosHeaders,
  });
  
  check(res, {
    'chaos endpoint responds': (r) => r.status < 500,
  });
}

// Main test function
export default function(data) {
  // Distribute load across different endpoints
  const rand = Math.random();
  
  if (rand < 0.3) {
    testRootEndpoint();
  } else if (rand < 0.5) {
    testServiceA();
  } else if (rand < 0.7) {
    testServiceB();
  } else if (rand < 0.85) {
    testCrossService();
  } else if (rand < 0.95) {
    testBatchEndpoint();
  } else {
    testChaosMode();
  }
  
  // Random sleep to simulate real user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Test teardown
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Load tests completed in ${duration.toFixed(2)} minutes`);
  console.log(`Test ID: ${data.testId}`);
  
  // Generate summary report
  console.log('\n=== Load Test Summary ===');
  console.log(`Successful requests: ${successfulRequests.value}`);
  console.log(`Error rate: ${(errorRate.value * 100).toFixed(2)}%`);
  console.log(`Avg response time: ${responseTime.avg.toFixed(2)}ms`);
  console.log(`P95 response time: ${responseTime.p(95).toFixed(2)}ms`);
  console.log(`P99 response time: ${responseTime.p(99).toFixed(2)}ms`);
}
