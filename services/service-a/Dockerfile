# Multi-stage build for Prism Service A

# Build stage
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source
COPY server.js .

# Test stage
FROM builder AS tester

# Run tests (you'll add tests later)
RUN npm test || true

# Production stage
FROM node:18-alpine

# Add metadata
LABEL maintainer="Your Name <your.email@example.com>"
LABEL description="Prism Service A - Red Team Microservice"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/yourusername/prism"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create app directory
WORKDIR /app

# Copy package files from builder
COPY --from=builder --chown=nodejs:nodejs /build/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy app source from builder
COPY --from=builder --chown=nodejs:nodejs /build/server.js .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV SERVICE_NAME="Service A (Red)"

# Start app
CMD ["node", "server.js"]
