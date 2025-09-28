import * as jaeger from 'jaeger-client';

// Initialize Jaeger tracer
export const initTracer = (serviceName: string) => {
  const config = {
    serviceName,
    sampler: {
      type: 'const',
      param: 1,
    },
    reporter: {
      collectorEndpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
      logSpans: process.env.NODE_ENV === 'development',
    },
  };

  const options = {
    tags: {
      'service.version': process.env.npm_package_version || '1.0.0',
      'service.environment': process.env.NODE_ENV || 'development',
    },
  };

  return jaeger.initTracer(config, options);
};

// Global tracer instance
let tracer: any = null;

export const getTracer = () => {
  if (!tracer) {
    tracer = initTracer(process.env.SERVICE_NAME || 'unknown-service');
  }
  return tracer;
};

// Start a new span
export const startSpan = (operationName: string, parentSpan?: any) => {
  const span = parentSpan
    ? getTracer().startSpan(operationName, { childOf: parentSpan })
    : getTracer().startSpan(operationName);

  return span;
};

// Middleware for Express to create spans for requests
export const tracingMiddleware = (req: any, res: any, next: any) => {
  const span = startSpan(`${req.method} ${req.path}`);
  span.setTag('http.method', req.method);
  span.setTag('http.url', req.url);
  span.setTag('service.name', process.env.SERVICE_NAME || 'unknown-service');

  // Add span to request for use in handlers
  req.span = span;

  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    span.finish();
  });

  next();
};

// Helper to create child spans
export const createChildSpan = (operationName: string, parentSpan: any) => {
  return startSpan(operationName, parentSpan);
};

// Helper to log events to spans
export const logToSpan = (span: any, event: string, data?: any) => {
  if (data) {
    span.log({ event, ...data });
  } else {
    span.log({ event });
  }
};

// Helper to set tags on spans
export const setSpanTag = (span: any, key: string, value: any) => {
  span.setTag(key, value);
};

// Helper to inject tracing headers for downstream calls
export const injectHeaders = (span: any) => {
  const headers: { [key: string]: string } = {};
  getTracer().inject(span, jaeger.opentracing.FORMAT_HTTP_HEADERS, headers);
  return headers;
};

// Helper to extract span context from headers
export const extractSpanContext = (headers: any) => {
  return getTracer().extract(jaeger.opentracing.FORMAT_HTTP_HEADERS, headers);
};