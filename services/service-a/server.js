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

// Metrics endpoint (for Prometheus)
app.get('/metrics', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: {
            count: os.cpus().length,
            loadavg: os.loadavg(),
            model: os.cpus()[0]?.model || 'unknown'
        },
        network: {
            hostname: os.hostname(),
            interfaces: Object.keys(os.networkInterfaces())
        },
        process: {
            pid: process.pid,
            versions: process.versions,
            platform: process.platform,
            arch: process.arch
        }
    });
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
        hostip: Object.values(os.networkInterfaces())
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
const server = app.listen(PORT, () => {
    console.log(`${SERVICE_COLOR}✨ ${SERVICE_NAME}${RESET_COLOR} listening on port ${PORT}`);
    console.log(`   📍 Health: http://localhost:${PORT}/health`);
    console.log(`   📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`   🔍 Version: http://localhost:${PORT}/version`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(`${SERVICE_COLOR}🛑 ${SERVICE_NAME} shutting down...${RESET_COLOR}`);
    server.close(() => {
        console.log(`${SERVICE_COLOR}👋 ${SERVICE_NAME} gracefully terminated${RESET_COLOR}`);
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(`${SERVICE_COLOR}🛑 ${SERVICE_NAME} interrupted...${RESET_COLOR}`);
    server.close(() => {
        console.log(`${SERVICE_COLOR}👋 ${SERVICE_NAME} gracefully terminated${RESET_COLOR}`);
        process.exit(0);
    });
});

module.exports = app; // For testing
