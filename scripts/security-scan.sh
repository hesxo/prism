#!/bin/bash

set -euo pipefail

echo "Prism Security Scan"
echo "====================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Trivy is installed
if ! command -v trivy &>/dev/null; then
    echo -e "${RED}Trivy not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y wget apt-transport-https
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
    echo deb https://aquasecurity.github.io/trivy-repo/deb generic main | sudo tee -a /etc/apt/sources.list.d/trivy.list
    sudo apt-get update
    sudo apt-get install -y trivy
fi

echo -e "${YELLOW}Scanning filesystem for vulnerabilities...${NC}"
echo "----------------------------------------"

# Scan Service A
echo -e "\n${YELLOW}Service A:${NC}"
trivy fs --severity HIGH,CRITICAL --exit-code 0 --ignorefile .trivyignore ./services/service-a

# Scan Service B
echo -e "\n${YELLOW}Service B:${NC}"
trivy fs --severity HIGH,CRITICAL --exit-code 0 --ignorefile .trivyignore ./services/service-b

# Scan NGINX
echo -e "\n${YELLOW}NGINX:${NC}"
trivy fs --severity HIGH,CRITICAL --exit-code 0 --ignorefile .trivyignore ./nginx

# Scan Docker images if they exist
echo -e "\n${YELLOW}Scanning Docker images...${NC}"
echo "----------------------------------------"

if docker image inspect prism-service-a:latest >/dev/null 2>&1; then
    echo -e "\n${YELLOW}Service A image:${NC}"
    trivy image --severity HIGH,CRITICAL --ignorefile .trivyignore prism-service-a:latest
else
    echo -e "${YELLOW}Service A image not found, skipping...${NC}"
fi

if docker image inspect prism-service-b:latest >/dev/null 2>&1; then
    echo -e "\n${YELLOW}Service B image:${NC}"
    trivy image --severity HIGH,CRITICAL --ignorefile .trivyignore prism-service-b:latest
else
    echo -e "${YELLOW}Service B image not found, skipping...${NC}"
fi

if docker image inspect prism-nginx:latest >/dev/null 2>&1; then
    echo -e "\n${YELLOW}NGINX image:${NC}"
    trivy image --severity HIGH,CRITICAL --ignorefile .trivyignore prism-nginx:latest
else
    echo -e "${YELLOW}NGINX image not found, skipping...${NC}"
fi

echo -e "\n${GREEN}Security scan complete!${NC}"
