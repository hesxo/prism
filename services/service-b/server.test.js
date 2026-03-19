const request = require('supertest');
const axios = require('axios');
const os = require('os');
const app = require('./server');

jest.mock('axios');

describe('Prism Service B', () => {
    afterEach(() => {
        axios.get.mockReset();
    });

    test('GET /health returns 200 and healthy status', async () => {
        const response = await request(app)
            .get('/health')
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('service');
        expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /ready returns 200 and ready status', async () => {
        const response = await request(app)
            .get('/ready')
            .expect(200);

        expect(response.body).toHaveProperty('ready', true);
        expect(response.body).toHaveProperty('dependencies');
    });

    test('GET / returns service information', async () => {
        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('service');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('endpoints');
    });

    test('GET / populates hostip when network interfaces are available', async () => {
        const spy = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
            eth0: [{ family: 'IPv4', internal: false, address: '1.2.3.4' }],
        });

        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('hostip', '1.2.3.4');

        spy.mockRestore();
    });

    test('GET / query-service-a returns 200 when Service A is reachable', async () => {
        axios.get.mockResolvedValue({ data: { service: 'Service A (Red)' } });

        const response = await request(app)
            .get('/query-service-a')
            .expect(200);

        expect(response.body).toHaveProperty('message', 'Successfully queried Service A');
        expect(response.body).toHaveProperty('serviceAResponse');
        expect(response.body.serviceAResponse).toHaveProperty('service', 'Service A (Red)');
    });

    test('POST / with invalid JSON triggers error handler', async () => {
        const response = await request(app)
            .post('/')
            .set('Content-Type', 'application/json')
            .send('{bad json')
            .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('service');
    });

    test('GET / uses safeNetworkInterfaces catch path when networkInterfaces throws', async () => {
        const spy = jest.spyOn(os, 'networkInterfaces').mockImplementation(() => {
            throw new Error('networkInterfaces failed');
        });

        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('hostip', 'unknown');

        spy.mockRestore();
    });

    test('GET / uses fallback hostip when network interfaces are present but no IPv4 public IP', async () => {
        const spy = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
            eth0: [{ family: 'IPv6', internal: false, address: '2001:db8::1' }],
        });

        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('hostip', 'unknown');

        spy.mockRestore();
    });

    test('GET / uses npm_package_version when set', async () => {
        const prev = process.env.npm_package_version;
        process.env.npm_package_version = '8.8.8';

        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('version', '8.8.8');

        if (prev === undefined) {
            delete process.env.npm_package_version;
        } else {
            process.env.npm_package_version = prev;
        }
    });

    test('GET /version uses npm_package_version when set', async () => {
        const prev = process.env.npm_package_version;
        process.env.npm_package_version = '9.9.9';

        const response = await request(app)
            .get('/version')
            .expect(200);

        expect(response.body).toHaveProperty('version', '9.9.9');

        if (prev === undefined) {
            delete process.env.npm_package_version;
        } else {
            process.env.npm_package_version = prev;
        }
    });

    test('GET / triggers error handler with err.status/err.message fallbacks', async () => {
        const spy = jest.spyOn(os, 'hostname').mockImplementation(() => {
            // Empty message ensures `err.message || "Internal Server Error"` branch is exercised.
            throw new Error('');
        });

        const response = await request(app)
            .get('/')
            .expect(500);

        expect(response.body).toHaveProperty('error', 'Internal Server Error');

        spy.mockRestore();
    });

    test('GET / triggers error handler with err.status and message branch', async () => {
        const spy = jest.spyOn(os, 'hostname').mockImplementation(() => {
            const err = new Error('Service down');
            err.status = 502;
            throw err;
        });

        const response = await request(app)
            .get('/')
            .expect(502);

        expect(response.body).toHaveProperty('error', 'Service down');

        spy.mockRestore();
    });

    test('GET /echo/:message echoes the message', async () => {
        const message = 'test-message';
        const response = await request(app)
            .get(`/echo/${message}`)
            .expect(200);

        expect(response.body).toHaveProperty('received', message);
    });

    test('GET /metrics returns Prometheus exposition text', async () => {
        const response = await request(app)
            .get('/metrics')
            .expect(200)
            .expect('Content-Type', /text\/plain/);

        expect(response.text).toContain('prism_service_uptime_seconds');
    });

    test('GET /metrics falls back when os.loadavg is unavailable', async () => {
        const loadavgDescriptor = Object.getOwnPropertyDescriptor(os, 'loadavg');
        const originalLoadavg = os.loadavg;

        try {
            Object.defineProperty(os, 'loadavg', {
                value: undefined,
                configurable: true,
                writable: true
            });

            const response = await request(app)
                .get('/metrics')
                .expect(200)
                .expect('Content-Type', /text\/plain/);

            expect(response.text).toContain('prism_service_loadavg_1{service="Service B (Blue)"} 0');
        } finally {
            Object.defineProperty(os, 'loadavg', {
                value: originalLoadavg,
                ...loadavgDescriptor
            });
        }
    });

    test('GET /version returns version info', async () => {
        const response = await request(app)
            .get('/version')
            .expect(200);

        expect(response.body).toHaveProperty('service');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('nodeVersion');
        expect(response.body).toHaveProperty('timestamp');
    });

    test('POST /batch returns processed results', async () => {
        const response = await request(app)
            .post('/batch')
            .send({ items: ['item1', 'item2'] })
            .expect(200);

        expect(response.body).toHaveProperty('batchSize', 2);
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body.results[0]).toHaveProperty('processed');
    });

    test('POST /batch returns 400 when items is missing', async () => {
        const response = await request(app)
            .post('/batch')
            .send({})
            .expect(400);

        expect(response.body).toHaveProperty('error', 'Items array is required');
    });

    test('GET /query-service-a returns 503 when Service A is unreachable', async () => {
        axios.get.mockRejectedValue(new Error('boom'));

        const response = await request(app)
            .get('/query-service-a')
            .expect(503);

        expect(response.body).toHaveProperty('error', 'Failed to reach Service A');
        expect(response.body).toHaveProperty('details');
    });

    test('GET /nonexistent returns 404', async () => {
        await request(app)
            .get('/nonexistent')
            .expect(404);
    });
});
