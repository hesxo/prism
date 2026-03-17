# 🔮 Prism - Microservices Reverse Proxy & Observability Platform

> *Splitting traffic and light to reveal the true state of your system*

Prism is a production-grade simulation platform that demonstrates intelligent traffic management, comprehensive observability, and DevSecOps practices in a microservices environment.

## ✨ The Name

Like an optical prism that splits light into its constituent colors, **Prism**:
- **Splits traffic** across multiple backend services via intelligent load balancing
- **Reveals insights** through a full observability stack (logs, metrics, and traces)
- **Reflects security** by integrating DevSecOps practices throughout the pipeline

## 🚀 Features

| Layer | Capabilities |
|-------|-------------|
| **Traffic Management** | NGINX reverse proxy, load balancing, failover handling |
| **Backend Services** | Multiple Node.js/Express services with health checks |
| **Observability** | Grafana dashboards, Loki logs, Prometheus metrics |
| **Security** | Trivy vulnerability scanning, secure defaults |
| **CI/CD** | Automated pipeline with CircleCI |

## 📋 Prerequisites

- Docker 20.10+ & Docker Compose 2.0+
- Node.js 18+ (for local development)
- CircleCI account (for CI/CD pipeline)
- 4GB+ RAM available for Docker

## 🏗️ Architecture

```text
          ┌─────────┐        ┌─────────┐         ┌──────────────┐
          │ Client  │ ───▶   │ NGINX   │  ───▶   │  Service A   │
          └─────────┘        │ Prism   │         ├──────────────┤
                             │ Reverse │  ───▶   │  Service B   │
                             │ Proxy   │         └──────────────┘
                             └────┬────┘
                                  │
                                  │
                            ┌─────▼─────┐        ┌──────────────┐
                            │ Prometheus│ ───▶   │   Grafana    │
                            └───────────┘        │  Dashboard   │
                                                 └──────────────┘
```
