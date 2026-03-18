const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const os = require('os');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'Service B (Blue)';
const SERVICE_COLOR = '\x1b[34m'; // Blue
const RESET_COLOR = '\x1b[0m';

// Some sandboxed environments can make `os.networkInterfaces()` throw.
const safeNetworkInterfaces = () => {
    try {
        return os.networkInterfaces() || {};
    } catch (e) {
        return {};
    }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan('combined'));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${SERVICE_COLOR}[${SERVICE_NAME}]${RESET_COLOR} ${req.method} ${req.url} - ${timestamp}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: SERVICE_NAME,
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Readiness check
app.get('/ready', (req, res) => {
    res.status(200).json({
        ready: true,
        service: SERVICE_NAME,
        dependencies: {
            database: 'connected',
            cache: 'connected',
            serviceA: 'available' // Mock dependency on Service A
        },
        timestamp: new Date().toISOString()
    });
});

// Metrics endpoint
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
            interfaces: Object.keys(safeNetworkInterfaces())
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
        color: 'blue',
        hostname: os.hostname(),
        hostip: Object.values(safeNetworkInterfaces())
            .flat()
            .find(iface => iface.family === 'IPv4' && !iface.internal)?.address || 'unknown',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        message: '🌊 Hello from the Blue service! The calm waters of Prism.',
        features: {
            canQueryServiceA: true,
            hasCaching: true,
            supportsBatch: true
        },
        endpoints: {
            health: '/health',
            ready: '/ready',
            metrics: '/metrics',
            version: '/version',
            echo: '/echo/:message',
            queryA: '/query-service-a'
        }
    });
});

// Echo endpoint
app.get('/echo/:message', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        received: req.params.message,
        query: req.query,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// Query Service A (demonstrates service-to-service communication)
app.get('/query-service-a', async (req, res) => {
    try {
        // Try to reach Service A through the internal network
        const response = await axios.get('http://service-a:3000/', {
            timeout: 5000
        });
        
        res.json({
            service: SERVICE_NAME,
            message: 'Successfully queried Service A',
            serviceAResponse: response.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            service: SERVICE_NAME,
            error: 'Failed to reach Service A',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Batch endpoint (demonstrates complex processing)
app.post('/batch', (req, res) => {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({
            error: 'Items array is required',
            service: SERVICE_NAME
        });
    }
    
    const results = items.map((item, index) => ({
        original: item,
        processed: `processed-${item}`,
        index,
        timestamp: new Date().toISOString()
    }));
    
    res.json({
        service: SERVICE_NAME,
        batchSize: items.length,
        results,
        processingTime: `${Math.random() * 100}ms`
    });
});

// Error handling
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

let server;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`${SERVICE_COLOR}🌊 ${SERVICE_NAME}${RESET_COLOR} listening on port ${PORT}`);
        console.log(`   📍 Health: http://localhost:${PORT}/health`);
        console.log(`   📊 Metrics: http://localhost:${PORT}/metrics`);
        console.log(`   🔗 Can query Service A: http://localhost:${PORT}/query-service-a`);
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
}

module.exports = app;
