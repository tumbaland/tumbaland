// Main monitoring exports - modular architecture

// Configuration and initialization
export { initMonitoring } from './config';

// Error and message tracking
export { captureException, captureMessage } from './errors';

// User and tag tracking
export { setUser, setTag } from './performance';

// Performance monitoring
export { startTransaction, recordMetric, initWebVitals } from './performance';

// Batch logging utilities
export { flushLogs } from './batch';

// Console interception (for advanced usage)
export { initConsoleInterception } from './console';

// Correlation ID utilities
export { generateCorrelationId, getCorrelationId, getSessionCorrelationId, fetchWithCorrelation } from './utils';

// Re-export types
export type { MonitoringConfig } from './config';