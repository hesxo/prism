#!/bin/bash

echo "🏋️  Running Prism Load Tests"
echo "============================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}k6 not found. Installing...${NC}"
    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
    echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
    sudo apt-get update
    sudo apt-get install k6
fi

# Check if services are running
echo -e "${YELLOW}Checking Prism services...${NC}"
if ! curl -s -f http://localhost/health > /dev/null; then
    echo -e "${RED}Prism is not running!${NC}"
    echo "Start Prism first with: docker-compose up -d"
    exit 1
fi
echo -e "${GREEN}✓ Prism is running${NC}"

# Create results directory
mkdir -p load-test-results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="load-test-results/$TIMESTAMP"
mkdir -p $RESULTS_DIR

# Function to run test and save results
run_test() {
    local test_name=$1
    local test_file=$2
    local output_file="$RESULTS_DIR/$test_name.json"
    
    echo -e "\n${BLUE}Running $test_name...${NC}"
    
    k6 run \
        --out json="$output_file" \
        --summary-export="$RESULTS_DIR/$test_name-summary.json" \
        "$test_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $test_name completed${NC}"
    else
        echo -e "${RED}✗ $test_name failed${NC}"
    fi
}

# Run different test scenarios
echo -e "\n${YELLOW}Test Scenarios:${NC}"
echo "1. Smoke Test (quick validation)"
echo "2. Load Test (normal traffic)"
echo "3. Stress Test (high traffic)"
echo "4. Soak Test (long duration)"
echo "5. Spike Test (sudden traffic)"
echo "6. All Tests"
echo ""

read -p "Select test scenario (1-6): " choice

case $choice in
    1)
        run_test "smoke-test" "scripts/performance-test.js"
        ;;
    2)
        export K6_SCENARIO="normal_load"
        run_test "load-test" "scripts/advanced-load-test.js"
        ;;
    3)
        export K6_SCENARIO="stress_test"
        run_test "stress-test" "scripts/advanced-load-test.js"
        ;;
    4)
        export K6_SCENARIO="soak_test"
        run_test "soak-test" "scripts/advanced-load-test.js"
        ;;
    5)
        export K6_SCENARIO="spike_test"
        run_test "spike-test" "scripts/advanced-load-test.js"
        ;;
    6)
        run_test "smoke-test" "scripts/performance-test.js"
        run_test "full-load-test" "scripts/advanced-load-test.js"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Generate HTML report
echo -e "\n${YELLOW}Generating HTML report...${NC}"

cat > "$RESULTS_DIR/report.html" << HTML
<!DOCTYPE html>
<html>
<head>
    <title>Prism Load Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { margin: 10px 0; }
        .good { color: green; }
        .warning { color: orange; }
        .bad { color: red; }
    </style>
</head>
<body>
    <h1>🔮 Prism Load Test Report</h1>
    <p>Timestamp: $TIMESTAMP</p>
    
    <div class="summary">
        <h2>Test Summary</h2>
        $(for summary in $RESULTS_DIR/*-summary.json; do
            echo "<div class='metric'>"
            echo "<h3>$(basename $summary .json)</h3>"
            jq -r '.metrics | to_entries[] | "<p>\(.key): \(.value.avg // .value.rate // .value.value)</p>"' $summary
            echo "</div>"
        done)
    </div>
</body>
</html>
HTML

echo -e "${GREEN}✅ Report generated: $RESULTS_DIR/report.html${NC}"
echo -e "${BLUE}Open in browser: file://$(pwd)/$RESULTS_DIR/report.html${NC}"

# Check if any thresholds were crossed
if grep -q '"thresholds":\s*{"failures"' $RESULTS_DIR/*.json; then
    echo -e "\n${RED}❌ Some thresholds were crossed!${NC}"
    exit 1
else
    echo -e "\n${GREEN}✅ All thresholds passed!${NC}"
fi
