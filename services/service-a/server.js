const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const os = require('os');
const opentracing = require('opentracing');
const { initTracer } = require('jaeger-client');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'Service A (Red)';
const SERVICE_COLOR = '\x1b[31m'; // Red
const RESET_COLOR = '\x1b[0m';
const { FORMAT_HTTP_HEADERS } = opentracing;

const tracingEnabled = !!(
    process.env.JAEGER_AGENT_HOST ||
    process.env.JAEGER_AGENT_PORT ||
    process.env.JAEGER_SERVICE_NAME ||
    process.env.JAEGER_REPORTER_LOG_SPANS
);

// Initialize Jaeger tracer with safe fallback to no-op tracer.
const tracer = (() => {
    if (!tracingEnabled) {
        return opentracing.globalTracer();
    }

    try {
        const config = {
            serviceName: SERVICE_NAME,
            sampler: {
                type: process.env.JAEGER_SAMPLER_TYPE || 'const',
                param: Number(process.env.JAEGER_SAMPLER_PARAM || 1)
            },
            reporter: {
                logSpans: (process.env.JAEGER_REPORTER_LOG_SPANS || 'true') === 'true',
                agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
                agentPort: Number(process.env.JAEGER_AGENT_PORT || 6831)
            }
        };

        return initTracer(config, {});
    } catch (error) {
        console.warn(
            `${SERVICE_COLOR}[${SERVICE_NAME}]${RESET_COLOR} Jaeger tracer init failed; continuing with no-op tracer.`,
            error.message
        );
        return opentracing.globalTracer();
    }
})();

const safeNetworkInterfaces = () => {
    try {
        return os.networkInterfaces() || {};
    } catch (e) {
        return {};
    }
};

const withSpan = (req, operation, fn) => {
    const childSpan = req.span ? tracer.startSpan(operation, { childOf: req.span }) : null;

    try {
        return fn(childSpan);
    } finally {
        if (childSpan) {
            childSpan.finish();
        }
    }
};

const traceIdFromSpan = (span) => {
    if (!span || !span.context || typeof span.context !== 'function') {
        return undefined;
    }

    try {
        return span.context().toTraceId();
    } catch {
        return undefined;
    }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan('combined'));

// Tracing middleware
app.use((req, res, next) => {
    let span = null;

    try {
        const parentSpanContext = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        span = parentSpanContext
            ? tracer.startSpan(req.path, { childOf: parentSpanContext })
            : tracer.startSpan(req.path);

        span.setTag(opentracing.Tags.SPAN_KIND, opentracing.Tags.SPAN_KIND_RPC_SERVER);
        span.setTag(opentracing.Tags.HTTP_METHOD, req.method);
        span.setTag(opentracing.Tags.HTTP_URL, req.originalUrl || req.url);
    } catch {
        span = null;
    }

    req.span = span;

    res.on('finish', () => {
        if (span) {
            span.setTag(opentracing.Tags.HTTP_STATUS_CODE, res.statusCode);
            if (res.statusCode >= 400) {
                span.setTag(opentracing.Tags.ERROR, true);
            }
            span.finish();
        }
    });

    next();
});

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${SERVICE_COLOR}[${SERVICE_NAME}]${RESET_COLOR} ${req.method} ${req.url} - ${timestamp}`);
    next();
});

app.get('/health', (req, res) => {
    withSpan(req, 'health-check', () => {
        res.status(200).json({
            status: 'healthy',
            service: SERVICE_NAME,
            version: process.env.npm_package_version || '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            traceId: traceIdFromSpan(req.span)
        });
    });
});

app.get('/ready', (req, res) => {
    withSpan(req, 'readiness-check', () => {
        res.status(200).json({
            ready: true,
            service: SERVICE_NAME,
            dependencies: {
                database: 'connected',
                cache: 'connected'
            },
            timestamp: new Date().toISOString(),
            traceId: traceIdFromSpan(req.span)
        });
    });
});

app.get('/metrics', (req, res) => {
    withSpan(req, 'metrics', () => {
        const loadavg = os.loadavg ? os.loadavg() : [0, 0, 0];
        const load1 = Number(loadavg[0]) || 0;
        const load5 = Number(loadavg[1]) || 0;
        const load15 = Number(loadavg[2]) || 0;

        const mem = process.memoryUsage();
        const ifaceCount = Object.keys(safeNetworkInterfaces()).length;

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
});

app.get('/version', (req, res) => {
    withSpan(req, 'version', () => {
        res.json({
            service: SERVICE_NAME,
            version: process.env.npm_package_version || '1.0.0',
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
            traceId: traceIdFromSpan(req.span)
        });
    });
});

app.get('/', (req, res) => {
    const span = req.span ? tracer.startSpan('root-endpoint', { childOf: req.span }) : null;

    try {
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
            traceId: traceIdFromSpan(span),
            endpoints: {
                health: '/health',
                ready: '/ready',
                metrics: '/metrics',
                version: '/version',
                echo: '/echo/:message'
            }
        });
    } finally {
        if (span) {
            span.finish();
        }
    }
});

app.get('/echo/:message', (req, res) => {
    withSpan(req, 'echo', () => {
        res.json({
            service: SERVICE_NAME,
            received: req.params.message,
            query: req.query,
            headers: req.headers,
            timestamp: new Date().toISOString(),
            traceId: traceIdFromSpan(req.span)
        });
    });
});

app.use((err, req, res, next) => {
    console.error(`${SERVICE_COLOR}[${SERVICE_NAME}] Error:${RESET_COLOR}`, err);

    if (req.span) {
        req.span.setTag(opentracing.Tags.ERROR, true);
        req.span.log({ event: 'error', message: err.message });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

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
/* istanbul ignore next */
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`${SERVICE_COLOR}✨ ${SERVICE_NAME}${RESET_COLOR} listening on port ${PORT}`);
        console.log(`   📍 Health: http://localhost:${PORT}/health`);
        console.log(`   📊 Metrics: http://localhost:${PORT}/metrics`);
        console.log(`   🔍 Version: http://localhost:${PORT}/version`);
        console.log(`   🔗 Traces: http://localhost:16686 (Jaeger UI)`);
    });

    const shutdown = (signal) => {
        console.log(`${SERVICE_COLOR}🛑 ${SERVICE_NAME} ${signal}...${RESET_COLOR}`);
        server.close(() => {
            if (tracer && typeof tracer.close === 'function') {
                tracer.close();
            }
            console.log(`${SERVICE_COLOR}👋 ${SERVICE_NAME} gracefully terminated${RESET_COLOR}`);
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('shutting down'));
    process.on('SIGINT', () => shutdown('interrupted'));
}

module.exports = app;
