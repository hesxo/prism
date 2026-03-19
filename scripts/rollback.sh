#!/bin/bash

# Prism Rollback Script
set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=${1:-staging}
PREVIOUS_TAG=${2:-previous}

echo -e "${BLUE}Rolling back Prism in ${ENVIRONMENT} to ${PREVIOUS_TAG}${NC}"
echo "================================"

export TAG="${PREVIOUS_TAG}"

case "${ENVIRONMENT}" in
    staging)
        docker-compose -f docker-compose.yml down
        docker-compose -f docker-compose.yml up -d
        echo -e "${GREEN}Rollback complete!${NC}"
        ;;

    production)
        echo -e "${RED}Production rollback requires confirmation${NC}"
        read -p "Are you sure you want to rollback production? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose -f docker-compose.yml down
            docker-compose -f docker-compose.yml up -d
            echo -e "${GREEN}Production rollback complete!${NC}"
        else
            echo -e "${YELLOW}Rollback cancelled${NC}"
        fi
        ;;

    *)
        echo -e "${RED}Unknown environment: ${ENVIRONMENT}${NC}"
        exit 1
        ;;
esac

