const request = require('supertest');

describe('Prism Service A tracing coverage', () => {
  const prevEnv = {
    JAEGER_AGENT_HOST: process.env.JAEGER_AGENT_HOST,
    JAEGER_AGENT_PORT: process.env.JAEGER_AGENT_PORT,
    JAEGER_SERVICE_NAME: process.env.JAEGER_SERVICE_NAME,
    JAEGER_REPORTER_LOG_SPANS: process.env.JAEGER_REPORTER_LOG_SPANS,
  };

  afterEach(() => {
    process.env.JAEGER_AGENT_HOST = prevEnv.JAEGER_AGENT_HOST;
    process.env.JAEGER_AGENT_PORT = prevEnv.JAEGER_AGENT_PORT;
    process.env.JAEGER_SERVICE_NAME = prevEnv.JAEGER_SERVICE_NAME;
    process.env.JAEGER_REPORTER_LOG_SPANS = prevEnv.JAEGER_REPORTER_LOG_SPANS;
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('opentracing');
    jest.dontMock('jaeger-client');
  });

  const makeOpentracingMock = (opts = {}) => {
    const {
      globalTracerImpl = null,
    } = opts;

    return {
      FORMAT_HTTP_HEADERS: 'x-b3-',
      Tags: {
        SPAN_KIND: 'span.kind',
        SPAN_KIND_RPC_SERVER: 'rpc-server',
        HTTP_METHOD: 'http.method',
        HTTP_URL: 'http.url',
        ERROR: 'error',
        HTTP_STATUS_CODE: 'http.status_code',
      },
      globalTracer: () => globalTracerImpl,
    };
  };

  const makeSpanMock = (opts = {}) => {
    const {
      toTraceId = () => 'trace-123',
    } = opts;

    return {
      setTag: jest.fn(),
      log: jest.fn(),
      finish: jest.fn(),
      context: () => ({
        toTraceId,
      }),
    };
  };

  const makeTracerMock = (opts = {}) => {
    const {
      extractImpl = () => ({}),
      startSpanImpl = () => makeSpanMock(),
    } = opts;

    return {
      extract: jest.fn(() => extractImpl()),
      startSpan: jest.fn(() => startSpanImpl()),
      close: jest.fn(),
    };
  };

  test('covers Jaeger tracer init (success) + tracing middleware success path', async () => {
    process.env.JAEGER_AGENT_HOST = '127.0.0.1';

    const spanMock = makeSpanMock({ toTraceId: () => 'trace-success' });
    const tracerMock = makeTracerMock({
      extractImpl: () => ({}),
      startSpanImpl: () => spanMock,
    });

    jest.doMock('opentracing', () => makeOpentracingMock({ globalTracerImpl: tracerMock }));
    jest.doMock('jaeger-client', () => ({ initTracer: () => tracerMock }));

    jest.resetModules();
    // eslint-disable-next-line global-require
    const app = require('./server');

    const res = await request(app).get('/health').expect(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body.traceId).toBe('trace-success');
  });

  test('covers Jaeger tracer init (failure) catch path', async () => {
    process.env.JAEGER_AGENT_HOST = '127.0.0.1';

    const spanMock = makeSpanMock({ toTraceId: () => 'trace-init-catch' });
    const tracerFallback = makeTracerMock({
      extractImpl: () => ({}),
      startSpanImpl: () => spanMock,
    });

    jest.doMock('opentracing', () => makeOpentracingMock({ globalTracerImpl: tracerFallback }));
    jest.doMock('jaeger-client', () => ({ initTracer: () => { throw new Error('init failed'); } }));

    jest.resetModules();
    // eslint-disable-next-line global-require
    const app = require('./server');

    const res = await request(app).get('/ready').expect(200);
    expect(res.body).toHaveProperty('ready', true);
  });

  test('covers tracing middleware catch path -> span = null', async () => {
    process.env.JAEGER_AGENT_HOST = '127.0.0.1';

    const tracerMock = makeTracerMock({
      extractImpl: () => {
        throw new Error('extract failed');
      },
      startSpanImpl: () => makeSpanMock(),
    });

    jest.doMock('opentracing', () => makeOpentracingMock({ globalTracerImpl: tracerMock }));
    jest.doMock('jaeger-client', () => ({ initTracer: () => tracerMock }));

    jest.resetModules();
    // eslint-disable-next-line global-require
    const app = require('./server');

    const res = await request(app)
      .get('/health')
      .expect(200);
    // When tracing middleware fails, req.span is null, so traceId should be undefined.
    expect(res.body.traceId).toBeUndefined();
  });

  test('covers traceIdFromSpan catch path (toTraceId throws)', async () => {
    process.env.JAEGER_AGENT_HOST = '127.0.0.1';

    const tracerMock = makeTracerMock({
      extractImpl: () => ({}),
      startSpanImpl: () => makeSpanMock({
        toTraceId: () => {
          throw new Error('toTraceId failed');
        },
      }),
    });

    jest.doMock('opentracing', () => makeOpentracingMock({ globalTracerImpl: tracerMock }));
    jest.doMock('jaeger-client', () => ({ initTracer: () => tracerMock }));

    jest.resetModules();
    // eslint-disable-next-line global-require
    const app = require('./server');

    const res = await request(app)
      .get('/version')
      .expect(200);
    expect(res.body).toHaveProperty('nodeVersion');
    expect(res.body.traceId).toBeUndefined();
  });
});

