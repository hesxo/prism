#!/bin/bash

set -euo pipefail

echo "Prism Test Suite"
echo "==================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS=0
PASSED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"

    TESTS=$((TESTS + 1))
    echo -n "Testing ${name}... "

    local response
    response="$(curl -s -o /dev/null -w "%{http_code}" "${url}")"

    if [ "${response}" = "${expected}" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP ${response})"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC} (Expected ${expected}, got ${response})"
    fi
}

# Wait for services
echo "Waiting for services to be ready..."
sleep 5

# Test basic endpoints
test_endpoint "NGINX Health" "http://localhost/health" "200"
test_endpoint "Service A Root" "http://localhost/api/v1/" "200"
test_endpoint "Service B Root" "http://localhost/api/v2/" "200"
test_endpoint "Service A Health" "http://localhost/api/v1/health" "200"
test_endpoint "Service B Health" "http://localhost/api/v2/health" "200"
test_endpoint "Service A Metrics" "http://localhost/api/v1/metrics" "200"
test_endpoint "Service B Metrics" "http://localhost/api/v2/metrics" "200"
test_endpoint "Service A Version" "http://localhost/api/v1/version" "200"
test_endpoint "Service B Version" "http://localhost/api/v2/version" "200"

# Test cross-service communication
echo ""
echo -e "${BLUE}Testing cross-service communication:${NC}"
echo -n "Service B querying Service A... "
local_response="$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v2/query-service-a)"
if [ "${local_response}" = "200" ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

# Test load balancing
echo ""
echo -e "${BLUE}Testing load balancing distribution:${NC}"
a_count=0
b_count=0
for i in {1..20}; do
    color="$(curl -s http://localhost/ | jq -r '.color' 2>/dev/null || true)"
    if [ "${color}" = "red" ]; then
        a_count=$((a_count + 1))
    elif [ "${color}" = "blue" ]; then
        b_count=$((b_count + 1))
    fi
done
echo "Service A (Red): ${a_count} requests"
echo "Service B (Blue): ${b_count} requests"

# Test failover
echo ""
echo -e "${BLUE}Testing failover handling:${NC}"
echo "Stopping Service A temporarily..."
docker-compose stop service-a
sleep 5

echo -n "Requests should now go only to Service B... "
all_blue=true
for i in {1..5}; do
    color="$(curl -s http://localhost/ | jq -r '.color' 2>/dev/null || true)"
    if [ "${color}" != "blue" ]; then
        all_blue=false
    fi
done

if [ "${all_blue}" = true ]; then
    echo -e "${GREEN}PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC}"
fi
TESTS=$((TESTS + 1))

# Restart Service A
echo "Restarting Service A..."
docker-compose start service-a
sleep 5

# Summary
echo ""
echo "==================="
echo -e "Test Summary: ${GREEN}${PASSED}/${TESTS} passed${NC}"

if [ "${PASSED}" -eq "${TESTS}" ]; then
    echo -e "${GREEN}All tests passed. Prism is working correctly.${NC}"
else
    echo -e "${RED}Some tests failed. Check the logs for details.${NC}"
fi

