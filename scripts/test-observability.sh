#!/bin/bash

set -euo pipefail

echo "Prism Observability Test Suite"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS=0
PASSED=0

# Helper function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"

    TESTS=$((TESTS + 1))
    echo -n "Testing ${name}... "

    response="$(curl -s -o /dev/null -w "%{http_code}" "${url}")"
    if [ "${response}" = "${expected}" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP ${response})"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC} (Expected ${expected}, got ${response})"
    fi
}

echo -e "${YELLOW}Step 1: Checking Observability Services${NC}"
echo "----------------------------------------"

# Test Prometheus
test_endpoint "Prometheus" "http://localhost:9090/-/healthy" "200"

# Test Loki
test_endpoint "Loki" "http://localhost:3100/ready" "200"

# Test Grafana
test_endpoint "Grafana" "http://localhost:3001/api/health" "200"

# Test cAdvisor (cAdvisor doesn't always expose /health; root page is a stable check)
test_endpoint "cAdvisor" "http://localhost:8080/" "200"

# Test Node Exporter (optional; may not be present)
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:9100/metrics" | grep -q "^200$"; then
    test_endpoint "Node Exporter" "http://localhost:9100/metrics" "200"
else
    echo "SKIP (Node Exporter not reachable on 9100)"
fi

echo -e "\n${YELLOW}Step 2: Generating Test Traffic${NC}"
echo "----------------------------------------"

# Generate traffic to create metrics and logs
echo "Sending requests to generate metrics..."
for i in {1..50}; do
    curl -s http://localhost/ >/dev/null || true
    curl -s http://localhost/api/v1/ >/dev/null || true
    curl -s http://localhost/api/v2/ >/dev/null || true
    curl -s http://localhost/api/v2/query-service-a >/dev/null || true

    sleep 0.$((RANDOM % 5))

    if [ $((i % 10)) -eq 0 ]; then
        echo "  ${i} requests sent..."
    fi
done

echo -e "\n${YELLOW}Step 3: Testing Prometheus Metrics${NC}"
echo "----------------------------------------"

# Query Prometheus for metrics
echo -n "Checking service discovery... "
response="$(curl -s "http://localhost:9090/api/v1/targets" | grep -c "service-a" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo -n "Querying CPU metrics... "
response="$(curl -s "http://localhost:9090/api/v1/query?query=rate(container_cpu_usage_seconds_total[1m])" | grep -c "value" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo -e "\n${YELLOW}Step 4: Testing Loki Logs${NC}"
echo "----------------------------------------"

echo -n "Checking log collection... "
sleep 5
response="$(curl -s "http://localhost:3100/loki/api/v1/query_range?query={compose_service=\"service-a\"}" | grep -c "stream" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo -e "\n${YELLOW}Step 5: Testing Grafana Datasources${NC}"
echo "----------------------------------------"

echo -n "Verifying Prometheus datasource... "
response="$(curl -s -u admin:admin "http://localhost:3001/api/datasources" | grep -c "Prometheus" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo -n "Verifying Loki datasource... "
response="$(curl -s -u admin:admin "http://localhost:3001/api/datasources" | grep -c "Loki" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo -e "\n${YELLOW}Step 6: Testing Alert Rules${NC}"
echo "----------------------------------------"

# Simulate a service failure to test alerts
echo "Simulating Service A failure..."
docker-compose pause service-a
sleep 10

echo -n "Checking if alert fired... "
response="$(curl -s "http://localhost:9090/api/v1/alerts" | grep -c "ServiceADown" || true)"
if [ "${response}" -gt 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

echo "Resuming Service A..."
docker-compose unpause service-a
sleep 5

echo -e "\n${YELLOW}Summary${NC}"
echo "----------------------------------------"
echo -e "Tests passed: ${GREEN}${PASSED}/${TESTS} ${NC}"

if [ "${PASSED}" -eq "${TESTS}" ]; then
    echo -e "${GREEN}All observability tests passed.${NC}"
    echo ""
    echo "Access your observability stack:"
    echo "   Grafana: http://localhost:3001 (admin/admin)"
    echo "   Prometheus: http://localhost:9090"
    echo "   Loki: http://localhost:3100"
    echo "   cAdvisor: http://localhost:8080"
else
    echo -e "${RED}Some tests failed. Check individual service logs.${NC}"
    echo "   docker-compose logs prometheus"
    echo "   docker-compose logs loki"
    echo "   docker-compose logs grafana"
fi

