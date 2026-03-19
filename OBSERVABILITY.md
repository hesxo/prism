# Prism Observability Stack

## Overview

Prism includes a comprehensive observability stack for monitoring, logging, and alerting.

## Components

### Metrics (Prometheus + Grafana)
- Prometheus: Scrapes metrics from all services every 15s
- Grafana: Visualizes metrics with pre-configured dashboards
- cAdvisor: Provides container-level metrics
- Node Exporter: Provides host-level metrics

### Logs (Loki + Promtail)
- Loki: Aggregates and stores logs
- Promtail: Collects logs from containers
- LogQL: Query language for log exploration

### Alerts (Alertmanager)
- Alertmanager: Handles alert routing and notification
- Slack Integration: Sends alerts to configured channels
- Email Notifications: Optional email alerts

## Access Points

| Service | URL | Credentials |
| --- | --- | --- |
| Grafana | http://localhost:3001 | admin/admin |
| Prometheus | http://localhost:9090 | - |
| Loki | http://localhost:3100 | - |
| cAdvisor | http://localhost:8080 | - |
| Alertmanager | http://localhost:9093 | - |

## Dashboards

### Main Dashboards
1. Prism Overview - Complete system view
2. Service A Detailed - Red team service metrics
3. Service B Detailed - Blue team service metrics
4. NGINX Detailed - Reverse proxy metrics

### Key Metrics
- Service uptime/health
- Request rates and latencies
- CPU and memory usage
- Network I/O
- Container restarts
- Error rates

## Log Exploration

### Example LogQL Queries
```logql
# All logs from Service A
{container_label_com_docker_compose_service="service-a"}

# Error logs from all services
{container_label_com_docker_compose_service=~"service-a|service-b"} |= "error"

# Logs with specific level
{container_label_com_docker_compose_service="service-a"} | json | level="error"

# Time-based queries
{container="nginx"} |= "GET"
```

