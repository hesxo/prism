const request = require('supertest');
const app = require('./server');

describe('Prism Service A', () => {
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

    test('GET /echo/:message echoes the message', async () => {
        const message = 'test-message';
        const response = await request(app)
            .get(`/echo/${message}`)
            .expect(200);
        
        expect(response.body).toHaveProperty('received', message);
    });

    test('GET /nonexistent returns 404', async () => {
        await request(app)
            .get('/nonexistent')
            .expect(404);
    });
});
