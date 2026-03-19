#!/bin/bash

echo "🌀 Running Chaos Experiments"
echo "============================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to apply chaos experiment
apply_experiment() {
    local experiment=$1
    echo -e "${YELLOW}Applying $experiment...${NC}"
    kubectl apply -f "chaos/experiments/$experiment.yaml"
}

# Function to check experiment status
check_experiment() {
    local experiment=$1
    echo -n "Checking $experiment status... "
    if kubectl get podchaos,networkchaos,stresschaos -n prism | grep -q "$experiment"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

# Function to monitor system during chaos
monitor_system() {
    echo -e "${BLUE}Monitoring system during chaos...${NC}"
    
    # Start monitoring in background
    (
        for i in {1..30}; do
            # Check service health
            curl -s -o /dev/null -w "%{http_code}" http://localhost/health
            
            # Check response times
            time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost/)
            echo "Response time: ${time}s"
            
            sleep 2
        done
    ) &
    
    MONITOR_PID=$!
}

# Main chaos test
echo -e "${BLUE}Starting chaos testing sequence...${NC}"

# Phase 1: Pod failure
echo -e "\n${YELLOW}Phase 1: Pod Failure Experiment${NC}"
apply_experiment "pod-failure"
monitor_system
sleep 35  # Wait for experiment to complete
kill $MONITOR_PID 2>/dev/null
check_experiment "pod-failure"

# Phase 2: Network delay
echo -e "\n${YELLOW}Phase 2: Network Delay Experiment${NC}"
apply_experiment "network-delay"
monitor_system
sleep 65
kill $MONITOR_PID 2>/dev/null
check_experiment "network-delay"

# Phase 3: CPU stress
echo -e "\n${YELLOW}Phase 3: CPU Stress Experiment${NC}"
apply_experiment "cpu-stress"
monitor_system
sleep 125
kill $MONITOR_PID 2>/dev/null
check_experiment "cpu-stress"

# Phase 4: Memory stress
echo -e "\n${YELLOW}Phase 4: Memory Stress Experiment${NC}"
apply_experiment "memory-stress"
monitor_system
sleep 65
kill $MONITOR_PID 2>/dev/null
check_experiment "memory-stress"

# Summary
echo -e "\n${BLUE}Chaos Testing Summary${NC}"
echo "======================"
echo -e "${GREEN}✅ All chaos experiments completed${NC}"
echo ""
echo "Check Grafana dashboards to see how the system handled chaos:"
echo "http://localhost:3001/d/prism-overview"
echo ""
echo "Check Jaeger for trace data during chaos:"
echo "http://localhost:16686"

# Clean up experiments
echo -e "\n${YELLOW}Cleaning up experiments...${NC}"
kubectl delete podchaos,networkchaos,stresschaos --all -n prism

echo -e "${GREEN}✅ Chaos testing complete!${NC}"
