#!/bin/bash

# Prism Load Testing Script
set -euo pipefail

echo "Prism Load Test"
echo "=================="

# Configuration
DURATION=${1:-60}  # Duration in seconds, default 60
CONCURRENCY=${2:-10}  # Concurrent requests, default 10
ENDPOINT=${3:-"http://localhost/"}  # Endpoint to test

echo "Duration: ${DURATION} seconds"
echo "Concurrency: ${CONCURRENCY}"
echo "Endpoint: ${ENDPOINT}"
echo ""

# Install hey if not present
if ! command -v hey &>/dev/null; then
    echo "Installing hey load testing tool..."
    if [[ "${OSTYPE}" == "linux-gnu"* ]]; then
        wget -q https://hey-release.s3.us-east-2.amazonaws.com/hey_linux_amd64 -O /tmp/hey
        chmod +x /tmp/hey
        HEY="/tmp/hey"
    elif [[ "${OSTYPE}" == "darwin"* ]]; then
        brew install hey
        HEY="hey"
    else
        echo "Please install hey manually: https://github.com/rakyll/hey"
        exit 1
    fi
else
    HEY="hey"
fi

echo "Starting load test..."
echo ""

# Run load test
"${HEY}" -z "${DURATION}s" -c "${CONCURRENCY}" "${ENDPOINT}"

echo ""
echo "Load test complete!"
echo ""
echo "Check Grafana at http://localhost:3001 to see the metrics"
echo "Look for:"
echo "  - Increased network traffic"
echo "  - CPU usage spikes"
echo "  - Memory consumption"
echo "  - Log entries in Loki"

