#!/bin/bash

# Prism Deployment Script
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-staging}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
TAG=${CIRCLE_SHA1:-latest}

echo -e "${BLUE}Deploying Prism to ${ENVIRONMENT}${NC}"
echo "================================"

# Function to check service health
check_health() {
    local service="$1"
    local port="$2"
    local max_attempts=30
    local attempt=1

    echo -n "Waiting for ${service} to be healthy..."
    while [ "${attempt}" -le "${max_attempts}" ]; do
        if curl -s -f "http://localhost:${port}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}FAILED${NC}"
    return 1
}

# Tag and push images
echo -e "${YELLOW}Tagging and pushing images...${NC}"
docker tag prism-service-a:latest "${DOCKER_REGISTRY}/prism-service-a:${TAG}"
docker tag prism-service-b:latest "${DOCKER_REGISTRY}/prism-service-b:${TAG}"
docker tag prism-nginx:latest "${DOCKER_REGISTRY}/prism-nginx:${TAG}"

docker push "${DOCKER_REGISTRY}/prism-service-a:${TAG}"
docker push "${DOCKER_REGISTRY}/prism-service-b:${TAG}"
docker push "${DOCKER_REGISTRY}/prism-nginx:${TAG}"

# Deploy based on environment
case "${ENVIRONMENT}" in
    staging)
        echo -e "${YELLOW}Deploying to staging...${NC}"
        export COMPOSE_PROJECT_NAME=prism-staging
        export TAG="${TAG}"

        docker-compose -f docker-compose.yml up -d

        # Check health
        check_health "nginx" 80
        check_health "grafana" 3001
        check_health "prometheus" 9090

        echo -e "${GREEN}Staging deployment complete!${NC}"
        ;;

    production)
        echo -e "${YELLOW}Deploying to production...${NC}"
        echo -e "${RED}Production deployment requires confirmation${NC}"
        read -p "Are you sure you want to deploy to production? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            export COMPOSE_PROJECT_NAME=prism-production
            export TAG="${TAG}"

            # Rolling update (basic)
            docker-compose -f docker-compose.yml up -d --no-deps --scale service-a=1 --no-recreate service-a
            sleep 10
            check_health "service-a" 3000

            docker-compose -f docker-compose.yml up -d --no-deps --scale service-b=1 --no-recreate service-b
            sleep 10
            check_health "service-b" 3000

            docker-compose -f docker-compose.yml up -d --no-deps nginx

            echo -e "${GREEN}Production deployment complete!${NC}"
        else
            echo -e "${YELLOW}Deployment cancelled${NC}"
            exit 0
        fi
        ;;

    *)
        echo -e "${RED}Unknown environment: ${ENVIRONMENT}${NC}"
        echo "Usage: ./scripts/deploy.sh [staging|production]"
        exit 1
        ;;
esac

# Run smoke tests
echo -e "${YELLOW}Running smoke tests...${NC}"
./scripts/test-prism.sh

echo -e "${GREEN}Deployment successful!${NC}"

