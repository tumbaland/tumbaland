/**
 * The real OpenTelemetry SDK/exporter/provider are mocked out — they're
 * network- and global-registry-heavy, and createBaseApp.test.ts already
 * exercises the real tracingMiddleware happy path end-to-end via supertest.
 * This file focuses on this module's own branching logic (env-var
 * resolution, parent-span-vs-context handling, the helper wrappers), using
 * the real (side-effect-free) @opentelemetry/api for trace/context/propagation.
 */
// A partial span: only the members these tests exercise are stubbed, cast to
// the full Span type so it satisfies the now-typed tracing helpers. The jest
// mocks remain reachable at runtime for the assertions below.
const mockSpan = () =>
  ({
    setAttribute: jest.fn(),
    addEvent: jest.fn(),
    end: jest.fn(),
    spanContext: jest.fn(() => ({ traceId: 't', spanId: 's', traceFlags: 1 }))
  }) as unknown as Span;

const mockTracer = { startSpan: jest.fn(() => mockSpan()) };
const registerMock = jest.fn();
const getTracerMock = jest.fn(() => mockTracer);
const providerCtorMock = jest.fn().mockImplementation((opts: unknown) => ({
  __opts: opts,
  register: registerMock,
  getTracer: getTracerMock
}));
const exporterCtorMock = jest.fn().mockImplementation((opts: unknown) => ({ __opts: opts }));
const spanProcessorCtorMock = jest.fn();
const resourceFromAttributesMock = jest.fn((attrs: unknown) => attrs);

jest.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: providerCtorMock,
  BatchSpanProcessor: spanProcessorCtorMock
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: exporterCtorMock
}));

jest.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: resourceFromAttributesMock
}));

import { context, Span } from '@opentelemetry/api';
import { ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

async function loadTracing() {
  let tracing!: typeof import('./index');
  await jest.isolateModulesAsync(async () => {
    tracing = await import('./index');
  });
  return tracing;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initTracer', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.JAEGER_ENDPOINT;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('exports nowhere when no endpoint is configured, rather than to a host that may not exist', async () => {
    const { initTracer } = await loadTracing();

    initTracer('album-service');

    expect(exporterCtorMock).not.toHaveBeenCalled();
    expect(spanProcessorCtorMock).not.toHaveBeenCalled();
    expect(providerCtorMock).toHaveBeenCalledWith(expect.objectContaining({ spanProcessors: [] }));
  });

  it('still registers a provider and hands back a tracer with no endpoint, so spans carry on', async () => {
    const { initTracer } = await loadTracing();

    initTracer('album-service');

    expect(registerMock).toHaveBeenCalled();
    expect(getTracerMock).toHaveBeenCalledWith('album-service');
  });

  it('prefers OTEL_EXPORTER_OTLP_TRACES_ENDPOINT over JAEGER_ENDPOINT', async () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://otel-endpoint/v1/traces';
    process.env.JAEGER_ENDPOINT = 'http://jaeger-endpoint/v1/traces';
    const { initTracer } = await loadTracing();

    initTracer('album-service');

    expect(exporterCtorMock).toHaveBeenCalledWith({ url: 'http://otel-endpoint/v1/traces' });
  });

  it('falls back to JAEGER_ENDPOINT when OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is unset', async () => {
    process.env.JAEGER_ENDPOINT = 'http://jaeger-endpoint/v1/traces';
    const { initTracer } = await loadTracing();

    initTracer('album-service');

    expect(exporterCtorMock).toHaveBeenCalledWith({ url: 'http://jaeger-endpoint/v1/traces' });
  });

  it('falls back to version 1.0.0 and environment "development" when their env vars are unset', async () => {
    const merged: Record<string, string | undefined> = { ...process.env };
    delete merged.npm_package_version;
    delete merged.NODE_ENV;
    process.env = merged as NodeJS.ProcessEnv;

    const { initTracer } = await loadTracing();
    initTracer('album-service');

    expect(resourceFromAttributesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        [ATTR_SERVICE_VERSION]: '1.0.0',
        'deployment.environment': 'development'
      })
    );
  });

  it('registers the provider and returns a tracer scoped to the given service name', async () => {
    const { initTracer } = await loadTracing();

    const tracer = initTracer('album-service');

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(getTracerMock).toHaveBeenCalledWith('album-service');
    expect(tracer).toBe(mockTracer);
  });
});

describe('getTracer', () => {
  it('lazily initializes on first call using SERVICE_NAME (or "unknown-service")', async () => {
    const { getTracer } = await loadTracing();

    getTracer();

    expect(getTracerMock).toHaveBeenCalledWith('unknown-service');
  });

  it('caches the tracer across calls instead of re-initializing', async () => {
    const { getTracer } = await loadTracing();

    getTracer();
    getTracer();

    expect(providerCtorMock).toHaveBeenCalledTimes(1);
  });
});

describe('startSpan', () => {
  it('starts a root span when no parent is given', async () => {
    const { startSpan } = await loadTracing();

    startSpan('op');

    expect(mockTracer.startSpan).toHaveBeenCalledWith('op');
  });

  it('starts a child span from a real Span parent (has spanContext()), deriving a parent context from it', async () => {
    const { startSpan } = await loadTracing();
    const parentSpan = mockSpan();

    startSpan('op', parentSpan);

    const [name, undef, parentContext] = mockTracer.startSpan.mock.calls[0] as unknown as [
      string,
      undefined,
      { getValue?: unknown }
    ];
    expect(name).toBe('op');
    expect(undef).toBeUndefined();
    // trace.setSpan(context.active(), parentSpan) returns a real Context, not the bare parentSpan.
    expect(parentContext).not.toBe(parentSpan);
    expect(typeof parentContext.getValue).toBe('function');
  });

  it('starts a span from a bare Context parent (no spanContext())', async () => {
    const { startSpan } = await loadTracing();
    const parentContext = context.active();

    startSpan('op', parentContext);

    expect(mockTracer.startSpan).toHaveBeenCalledWith('op', undefined, parentContext);
  });
});

describe('createChildSpan', () => {
  it('delegates to startSpan with the given parent', async () => {
    const { createChildSpan } = await loadTracing();
    const parentSpan = mockSpan();

    createChildSpan('child-op', parentSpan);

    expect(mockTracer.startSpan).toHaveBeenCalledWith('child-op', undefined, expect.anything());
  });
});

describe('logToSpan', () => {
  it('adds an event with data to the given span', async () => {
    const { logToSpan } = await loadTracing();
    const span = mockSpan();

    logToSpan(span, 'cache-miss', { key: 'abc' });

    expect(span.addEvent).toHaveBeenCalledWith('cache-miss', { key: 'abc' });
  });
});

describe('setSpanTag', () => {
  it('sets an attribute on the given span', async () => {
    const { setSpanTag } = await loadTracing();
    const span = mockSpan();

    setSpanTag(span, 'user.id', '42');

    expect(span.setAttribute).toHaveBeenCalledWith('user.id', '42');
  });
});

describe('injectHeaders', () => {
  it('returns a headers object without throwing', async () => {
    const { injectHeaders } = await loadTracing();
    const span = mockSpan();

    const headers = injectHeaders(span);

    expect(typeof headers).toBe('object');
  });
});

describe('extractSpanContext', () => {
  it('returns a Context derived from the given headers', async () => {
    const { extractSpanContext } = await loadTracing();

    const extracted = extractSpanContext({ traceparent: '00-abc-def-01' });

    expect(typeof (extracted as unknown as Record<string, unknown>).getValue).toBe('function');
  });
});

describe('tracingMiddleware', () => {
  function mockReqRes() {
    const req: {
      method: string;
      path: string;
      url: string;
      headers: object;
      span?: { setAttribute: jest.Mock; end: jest.Mock };
    } = {
      method: 'GET',
      path: '/albums',
      url: '/albums?x=1',
      headers: {}
    };
    const handlers: Record<string, () => void> = {};
    const res = {
      statusCode: 200,
      on: jest.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      })
    };
    return { req, res, handlers };
  }

  it('starts a server span, attaches it to the request, and calls next', async () => {
    const { tracingMiddleware } = await loadTracing();
    const { req, res } = mockReqRes();
    const next = jest.fn();

    tracingMiddleware(req as never, res as never, next);

    expect(req.span).toBeDefined();
    expect(req.span?.setAttribute).toHaveBeenCalledWith('http.method', 'GET');
    expect(req.span?.setAttribute).toHaveBeenCalledWith('http.url', '/albums?x=1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('records the response status code and ends the span on finish', async () => {
    const { tracingMiddleware } = await loadTracing();
    const { req, res, handlers } = mockReqRes();
    const next = jest.fn();

    tracingMiddleware(req as never, res as never, next);
    res.statusCode = 404;
    handlers.finish();

    expect(req.span?.setAttribute).toHaveBeenCalledWith('http.status_code', 404);
    expect(req.span?.end).toHaveBeenCalledTimes(1);
  });
});
