#!/bin/bash

# Blue/Green Deployment Script for Prism
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE=${1:-service-a}
VERSION=${2:-v2}
NAMESPACE="prism"

echo -e "${BLUE}🔵🟢 Blue/Green Deployment for $SERVICE${NC}"
echo "========================================"

# Function to check service health
check_health() {
    local service=$1
    local version=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $service ($version) to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if kubectl get pods -n $NAMESPACE -l app=$service,version=$version | grep -q "Running"; then
            echo -e "${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗${NC}"
    return 1
}

# Function to switch traffic
switch_traffic() {
    local service=$1
    local version=$2
    
    echo -e "${YELLOW}Switching traffic to $version...${NC}"
    
    # Update service selector to point to new version
    kubectl patch svc $service -n $NAMESPACE -p "{\"spec\":{\"selector\":{\"app\":\"$service\",\"version\":\"$version\"}}}"
    
    echo -e "${GREEN}✅ Traffic switched to $version${NC}"
}

# Determine current active version
CURRENT_VERSION=$(kubectl get svc $SERVICE -n $NAMESPACE -o jsonpath='{.spec.selector.version}')
echo "Current active version: $CURRENT_VERSION"

# Determine new version (if not specified)
if [ "$CURRENT_VERSION" = "v1" ]; then
    NEW_VERSION="v2"
else
    NEW_VERSION="v1"
fi

if [ ! -z "$VERSION" ] && [ "$VERSION" != "$CURRENT_VERSION" ]; then
    NEW_VERSION=$VERSION
fi

echo "New version to deploy: $NEW_VERSION"

# Check if new version already exists
if kubectl get deployment ${SERVICE}-${NEW_VERSION} -n $NAMESPACE &>/dev/null; then
    echo -e "${YELLOW}Deployment ${SERVICE}-${NEW_VERSION} already exists${NC}"
    read -p "Do you want to redeploy? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 0
    fi
fi

# Create new deployment from template
echo -e "${YELLOW}Creating ${SERVICE}-${NEW_VERSION} deployment...${NC}"

# Get current deployment spec and modify version
kubectl get deployment ${SERVICE} -n $NAMESPACE -o yaml | \
    sed "s/version: $CURRENT_VERSION/version: $NEW_VERSION/g" | \
    sed "s/name: $SERVICE/name: ${SERVICE}-${NEW_VERSION}/g" | \
    kubectl apply -f -

# Wait for new deployment to be ready
check_health $SERVICE $NEW_VERSION

# Run smoke tests against new version
echo -e "${YELLOW}Running smoke tests on new version...${NC}"

# Port forward to test new version
kubectl port-forward -n $NAMESPACE deployment/${SERVICE}-${NEW_VERSION} 3001:3000 &
PF_PID=$!
sleep 3

# Test endpoints
curl -s http://localhost:3001/health | grep -q "healthy"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    kill $PF_PID
    exit 1
fi

curl -s http://localhost:3001/version | grep -q "$NEW_VERSION"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Version check passed${NC}"
else
    echo -e "${RED}❌ Version check failed${NC}"
    kill $PF_PID
    exit 1
fi

kill $PF_PID

# Ask for confirmation before switching traffic
echo ""
echo -e "${YELLOW}Ready to switch traffic to $NEW_VERSION${NC}"
read -p "Continue with switch? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Switch traffic
    switch_traffic $SERVICE $NEW_VERSION
    
    # Keep old version running for rollback
    echo -e "${YELLOW}Keeping old version ($CURRENT_VERSION) for rollback${NC}"
    
    echo -e "${GREEN}✅ Blue/Green deployment complete!${NC}"
    echo "Active version: $NEW_VERSION"
    echo "Standby version: $CURRENT_VERSION"
else
    echo -e "${YELLOW}Deployment cancelled. Scaling down new version...${NC}"
    kubectl scale deployment ${SERVICE}-${NEW_VERSION} -n $NAMESPACE --replicas=0
    echo -e "${RED}Deployment cancelled${NC}"
fi
