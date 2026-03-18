const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'Service A (Red)';
const SERVICE_COLOR = '\x1b[31m'; // Red
const RESET_COLOR = '\x1b[0m';

// Some sandboxed environments can make `os.networkInterfaces()` throw.
// Keep the service resilient so `/` and `/metrics` don't hard-fail.
const safeNetworkInterfaces = () => {
    try {
        return os.networkInterfaces() || {};
    } catch (e) {
        return {};
    }
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(morgan('combined')); // HTTP request logging

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${SERVICE_COLOR}[${SERVICE_NAME}]${RESET_COLOR} ${req.method} ${req.url} - ${timestamp}`);
    next();
});

// Health check endpoint (for container orchestration)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: SERVICE_NAME,
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Readiness check endpoint (for Kubernetes-style probes)
app.get('/ready', (req, res) => {
    // Add any dependency checks here (database, cache, etc.)
    res.status(200).json({
        ready: true,
        service: SERVICE_NAME,
        dependencies: {
            database: 'connected', // Mock status
            cache: 'connected'     // Mock status
        },
        timestamp: new Date().toISOString()
    });
});

// Metrics endpoint (Prometheus exposition format)
app.get('/metrics', (req, res) => {
    const loadavg = os.loadavg ? os.loadavg() : [0, 0, 0];
    const load1 = Number(loadavg[0]) || 0;
    const load5 = Number(loadavg[1]) || 0;
    const load15 = Number(loadavg[2]) || 0;

    const mem = process.memoryUsage();
    const ifaceCount = Object.keys(safeNetworkInterfaces()).length;

    // Minimal set of metrics in text format so Prometheus scrape succeeds.
    // (Grafana "Service Status" uses `up{job="service-a"}`.)
    const metrics = [
        '# TYPE prism_service_uptime_seconds gauge',
        `prism_service_uptime_seconds{service="${SERVICE_NAME}"} ${process.uptime()}`,
        '# TYPE prism_service_memory_heap_used_bytes gauge',
        `prism_service_memory_heap_used_bytes{service="${SERVICE_NAME}"} ${mem.heapUsed}`,
        '# TYPE prism_service_memory_rss_bytes gauge',
        `prism_service_memory_rss_bytes{service="${SERVICE_NAME}"} ${mem.rss}`,
        '# TYPE prism_service_cpu_count gauge',
        `prism_service_cpu_count{service="${SERVICE_NAME}"} ${os.cpus().length}`,
        '# TYPE prism_service_loadavg_1 gauge',
        `prism_service_loadavg_1{service="${SERVICE_NAME}"} ${load1}`,
        '# TYPE prism_service_loadavg_5 gauge',
        `prism_service_loadavg_5{service="${SERVICE_NAME}"} ${load5}`,
        '# TYPE prism_service_loadavg_15 gauge',
        `prism_service_loadavg_15{service="${SERVICE_NAME}"} ${load15}`,
        '# TYPE prism_service_network_interfaces gauge',
        `prism_service_network_interfaces{service="${SERVICE_NAME}"} ${ifaceCount}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics + '\n');
});

// Version endpoint
app.get('/version', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    });
});

// Main endpoint
app.get('/', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        color: 'red',
        hostname: os.hostname(),
        hostip: Object.values(safeNetworkInterfaces())
            .flat()
            .find(iface => iface.family === 'IPv4' && !iface.internal)?.address || 'unknown',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        message: 'Hello from the Red service! Part of the Prism spectrum.',
        endpoints: {
            health: '/health',
            ready: '/ready',
            metrics: '/metrics',
            version: '/version',
            echo: '/echo/:message'
        }
    });
});

// Echo endpoint for testing
app.get('/echo/:message', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        received: req.params.message,
        query: req.query,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`${SERVICE_COLOR}[${SERVICE_NAME}] Error:${RESET_COLOR}`, err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        service: SERVICE_NAME,
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Start server
let server;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`${SERVICE_COLOR}✨ ${SERVICE_NAME}${RESET_COLOR} listening on port ${PORT}`);
        console.log(`   📍 Health: http://localhost:${PORT}/health`);
        console.log(`   📊 Metrics: http://localhost:${PORT}/metrics`);
        console.log(`   🔍 Version: http://localhost:${PORT}/version`);
    });

    const shutdown = (signal) => {
        console.log(`${SERVICE_COLOR}🛑 ${SERVICE_NAME} ${signal}...${RESET_COLOR}`);
        server.close(() => {
            console.log(`${SERVICE_COLOR}👋 ${SERVICE_NAME} gracefully terminated${RESET_COLOR}`);
            process.exit(0);
        });
    };

    // Graceful shutdown (only when run directly)
    process.on('SIGTERM', () => shutdown('shutting down'));
    process.on('SIGINT', () => shutdown('interrupted'));
}

module.exports = app; // For testing
