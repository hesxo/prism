#!/bin/bash

set -euo pipefail

echo "Prism Health Check"
echo "===================="

# Check if docker-compose is running
if ! docker-compose ps 2>/dev/null | awk 'NR==1{next} /Up/ {found=1} END{exit !found}'; then
    echo "No services are running"
    exit 1
fi

command -v curl >/dev/null 2>&1 || { echo "curl not found"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq not found"; exit 1; }

# Check NGINX
echo -n "Testing NGINX... "
if curl -s -f -o /dev/null http://localhost/; then
    echo "OK"
else
    echo "FAIL"
fi

# Check Service A
echo -n "Testing Service A... "
if curl -s -f -o /dev/null http://localhost/api/v1/health; then
    echo "OK"
else
    echo "FAIL"
fi

# Check Service B
echo -n "Testing Service B... "
if curl -s -f -o /dev/null http://localhost/api/v2/health; then
    echo "OK"
else
    echo "FAIL"
fi

echo ""
echo "Load Balancing Demo"
echo "======================"
echo "Hitting root endpoint 10 times (should see both services):"
for i in {1..10}; do
    curl -s http://localhost/ | jq -r '.service'
done

echo ""
echo "Container Status:"
docker-compose ps

