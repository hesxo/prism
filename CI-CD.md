# Prism CI/CD Pipeline

## Overview

Prism uses CircleCI for continuous integration and deployment. The pipeline includes security scanning, testing, building, and deployment stages.

## Pipeline Stages

### 1. Security Scan (`security_scan`)
- Scans Dockerfiles and source code for vulnerabilities
- Uses Trivy for vulnerability detection
- Fails on HIGH/CRITICAL vulnerabilities

### 2. Build & Test (`build_and_test`)
- Installs dependencies
- Runs unit tests with coverage
- Performs linting and formatting checks
- Persists workspace for subsequent jobs

### 3. Build Images (`build_images`)
- Builds Docker images for all services
- Tags images with commit SHA
- Saves images for later jobs

### 4. Scan Images (`scan_images`)
- Scans built Docker images for vulnerabilities
- Ensures no HIGH/CRITICAL vulnerabilities in production images
- Provides security report

### 5. Integration Tests (`integration_tests`)
- Starts all services using Docker Compose
- Runs comprehensive integration tests
- Tests cross-service communication
- Validates observability stack

### 6. Performance Tests (`performance_tests`)
- Runs load tests using k6
- Measures response times and error rates
- Ensures performance thresholds are met

### 7. Deploy to Staging (`deploy_staging`)
- Deploys to staging environment
- Runs smoke tests after deployment
- Notifies team on Slack

## Workflows

### Main Workflow (All Branches)
