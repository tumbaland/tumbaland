import { context, propagation, trace, SpanKind, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry tracer provider, exporting via OTLP/HTTP.
// Endpoint resolution: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT > JAEGER_ENDPOINT > in-cluster collector default.
export const initTracer = (serviceName: string): Tracer => {
  const url =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.JAEGER_ENDPOINT ||
    'http://jaeger-collector:4318/v1/traces';

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url }))],
  });
  provider.register();

  return provider.getTracer(serviceName);
};

// Global tracer instance
let tracer: Tracer | null = null;

export const getTracer = (): Tracer => {
  if (!tracer) {
    tracer = initTracer(process.env.SERVICE_NAME || 'unknown-service');
  }
  return tracer;
};

// Start a new span. `parent` may be a Span or a Context (e.g. from extractSpanContext).
export const startSpan = (operationName: string, parentSpan?: any) => {
  if (!parentSpan) {
    return getTracer().startSpan(operationName);
  }
  const parentContext =
    typeof parentSpan.spanContext === 'function'
      ? trace.setSpan(context.active(), parentSpan)
      : parentSpan;
  return getTracer().startSpan(operationName, undefined, parentContext);
};

// Middleware for Express to create spans for requests
export const tracingMiddleware = (req: any, res: any, next: any) => {
  const parentContext = propagation.extract(context.active(), req.headers);
  const span = getTracer().startSpan(
    `${req.method} ${req.path}`,
    { kind: SpanKind.SERVER },
    parentContext
  );
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.url);

  // Add span to request for use in handlers
  req.span = span;

  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });

  next();
};

// Helper to create child spans
export const createChildSpan = (operationName: string, parentSpan: any) => {
  return startSpan(operationName, parentSpan);
};

// Helper to log events to spans
export const logToSpan = (span: any, event: string, data?: any) => {
  span.addEvent(event, data);
};

// Helper to set tags on spans
export const setSpanTag = (span: any, key: string, value: any) => {
  span.setAttribute(key, value);
};

// Helper to inject tracing headers (W3C traceparent) for downstream calls
export const injectHeaders = (span: any) => {
  const headers: { [key: string]: string } = {};
  propagation.inject(trace.setSpan(context.active(), span), headers);
  return headers;
};

// Helper to extract span context from incoming headers; pass the result to startSpan as parent
export const extractSpanContext = (headers: any) => {
  return propagation.extract(context.active(), headers);
};
