// Web vitals will be loaded dynamically
let webVitals: any = null;

// Circuit breaker for logging API resilience (functional implementation)
function createLoggingCircuitBreaker(options: {
  failureThreshold?: number;
  recoveryTimeout?: number;
  successThreshold?: number;
} = {}) {
  const config = {
    failureThreshold: options.failureThreshold || 5,
    recoveryTimeout: options.recoveryTimeout || 30000, // 30 seconds
    successThreshold: options.successThreshold || 3
  };

  // Circuit state
  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let failures = 0;
  let successes = 0;
  let nextAttemptTime = 0;
  let lastFailureTime = 0;

  // Custom error for circuit open state
  class CircuitOpenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CircuitOpenError';
    }
  }

  function onSuccess() {
    failures = 0;
    lastFailureTime = 0;

    if (state === 'half-open') {
      successes++;
      if (successes >= config.successThreshold) {
        state = 'closed';
        console.log('🔄 Logging circuit closed - service recovered');
      }
    }
  }

  function onFailure() {
    failures++;
    lastFailureTime = Date.now();

    if (failures >= config.failureThreshold) {
      state = 'open';
      nextAttemptTime = Date.now() + config.recoveryTimeout;
      console.warn(`🚨 Logging circuit opened - ${failures} failures detected`);
    }
  }

  async function call(operation: () => Promise<any>): Promise<any> {
    const now = Date.now();

    // Check if we should attempt recovery
    if (state === 'open' && now >= nextAttemptTime) {
      state = 'half-open';
      successes = 0;
    }

    // If circuit is open, fail fast
    if (state === 'open') {
      throw new CircuitOpenError('Logging circuit is open - service unavailable');
    }

    try {
      const result = await operation();
      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      throw error;
    }
  }

  function getState() {
    return {
      state,
      failures,
      lastFailureTime,
      nextAttemptTime
    };
  }

  function reset() {
    state = 'closed';
    failures = 0;
    successes = 0;
    nextAttemptTime = 0;
    lastFailureTime = 0;
  }

  return {
    call,
    getState,
    reset,
    CircuitOpenError
  };
}

// Global circuit breaker instance
const loggingCircuit = createLoggingCircuitBreaker();

// Utility function to generate correlation IDs
const generateCorrelationId = (): string => {
  return 'frontend-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

// Global monitoring configuration
let monitoringConfig: {
  isDevelopment: boolean;
  service: string;
  component: string;
  elkUrl?: string;
  captureConsoleLevels?: ('debug' | 'info' | 'warn' | 'error')[];
} = {
  isDevelopment: false,
  service: 'frontend',
  component: 'frontend'
};

// Flag to prevent recursive console interception
let isInterceptingConsole = false;

// Log batching for better performance
let logBatch: any[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000; // 5 seconds

// Send batched logs
const sendBatch = async () => {
  if (logBatch.length === 0 || !monitoringConfig.elkUrl) return;

  const batchToSend = [...logBatch];
  logBatch = [];

  try {
    await loggingCircuit.call(async () => {
      const response = await fetch(monitoringConfig.elkUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchToSend),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    });
  } catch (error) {
    if (error instanceof loggingCircuit.CircuitOpenError) {
      // Circuit is open - implement fallback behavior
      console.warn('🚨 Logging circuit open - falling back to console logging');
      // Fallback: log to console with special marker
      batchToSend.forEach(log => {
        console.warn('📝 [CIRCUIT OPEN] Buffered log:', log);
      });
    } else {
      // Regular error - re-queue for retry
      console.warn('Failed to send log batch, will retry:', error);
      logBatch.unshift(...batchToSend);
    }
  }
};

// Queue log for batching
const queueLog = (logData: any) => {
  logBatch.push(logData);

  // Send immediately if batch is full
  if (logBatch.length >= BATCH_SIZE) {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    sendBatch();
    return;
  }

  // Schedule batch send
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      batchTimeout = null;
      sendBatch();
    }, BATCH_INTERVAL);
  }
};

// Initialize local monitoring (no remote services)
export const initMonitoring = (environment: string = 'development', options: {
  service?: string;
  component?: string;
  elkUrl?: string;
  captureConsoleLevels?: ('debug' | 'info' | 'warn' | 'error')[];
} = {}) => {
  const { 
    service = 'frontend', 
    component = 'frontend', 
    elkUrl,
    captureConsoleLevels = ['error', 'warn'] // Default to error and warn only
  } = options;
  
  // Update global config
  monitoringConfig = {
    isDevelopment: environment === 'development',
    service,
    component,
    elkUrl
  };
  
  console.log(`📊 Local monitoring initialized (${environment} mode) for ${service}/${component}`);
  console.log(`📝 Console interception enabled for levels: ${captureConsoleLevels.join(', ')}`);

  // Helper function to conditionally intercept console methods
  const interceptConsole = (
    methodName: keyof Console, 
    level: 'debug' | 'info' | 'warn' | 'error'
  ) => {
    if (!captureConsoleLevels.includes(level)) return;
    
    const originalMethod = (console as any)[methodName];
    (console as any)[methodName] = (...args: any[]) => {
      // Call original console method
      originalMethod.apply(console, args);
      
      // Prevent recursive interception
      if (isInterceptingConsole) return;
      
      // Send to logging API
      isInterceptingConsole = true;
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        captureMessage(message, level, {
          source: `console.${methodName}`,
          args: args
        });
      } finally {
        isInterceptingConsole = false;
      }
    };
  };

  // Set up global error handler
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureException(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      captureException(new Error(`Unhandled promise rejection: ${event.reason}`), {
        type: 'unhandledrejection'
      });
    });

    // Intercept console methods based on configuration
    interceptConsole('error', 'error');
    interceptConsole('warn', 'warn');
    interceptConsole('log', 'info');
    interceptConsole('info', 'info');
    interceptConsole('debug', 'debug');
  }
};

// Error tracking with local ELK logging
export const captureException = async (
  error: Error, 
  context?: any, 
  options: {
    isDevelopment?: boolean;
    service?: string;
    component?: string;
    elkUrl?: string;
  } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  const errorData = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: config.service,
    component: config.component,
    message: error.message,
    stack: error.stack,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    context: context || {},
    correlationId: generateCorrelationId()
  };

  // Always log to console for development
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      console.error('🚨 Frontend Error:', errorData);
    } finally {
      isInterceptingConsole = false;
    }
  }

  // Send to local ELK stack if available (batched)
  if (config.elkUrl) {
    queueLog(errorData);
  }
};

export const captureMessage = async (
  message: string, 
  level: 'debug' | 'info' | 'warn' | 'error' = 'info', 
  context?: any, 
  options: {
    isDevelopment?: boolean;
    service?: string;
    component?: string;
    elkUrl?: string;
  } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  const logData = {
    timestamp: new Date().toISOString(),
    level: level.toLowerCase(),
    service: config.service,
    component: config.component,
    message,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    context: context || {},
    correlationId: generateCorrelationId()
  };

  // Always log to console for development
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      const logLevel = level.toUpperCase();
      console.log(`[${logLevel}] ${message}`, context || '');
    } finally {
      isInterceptingConsole = false;
    }
  }

  // Send to local ELK stack if available (batched)
  if (config.elkUrl) {
    queueLog(logData);
  }
};

// User tracking (local storage only)
export const setUser = (
  user: { id: string; email?: string; username?: string }, 
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      console.log('👤 User set:', user);
    } finally {
      isInterceptingConsole = false;
    }
  }
  // Could store in localStorage for persistence if needed
};

export const setTag = (
  key: string, 
  value: string, 
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      console.log(`🏷️ Tag set: ${key} = ${value}`);
    } finally {
      isInterceptingConsole = false;
    }
  }
  // Store tags locally if needed for context
};

// Performance monitoring utilities (local only)
export const startTransaction = (
  name: string, 
  op: string, 
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  const startTime = Date.now();
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      console.log(`⏱️ Transaction started: ${name} (${op})`);
    } finally {
      isInterceptingConsole = false;
    }
  }

  return {
    finish: () => {
      const duration = Date.now() - startTime;
      recordMetric(`${name}_duration`, duration, 'ms', { isDevelopment: config.isDevelopment });
      if (config.isDevelopment) {
        isInterceptingConsole = true;
        try {
          console.log(`✅ Transaction finished: ${name} (${duration}ms)`);
        } finally {
          isInterceptingConsole = false;
        }
      }
    }
  };
};

export const recordMetric = (
  name: string, 
  value: number | { value: number; id?: string }, 
  unit: string = 'ms', 
  options: { isDevelopment?: boolean } = {}
) => {
  const config = { ...monitoringConfig, ...options };
  
  // Handle both number and metric object formats
  const metricValue = typeof value === 'number' ? value : value.value;

  // Always log to console for development with better formatting
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      const formattedValue = unit === 'ms' ? `${metricValue.toFixed(2)}ms` : `${metricValue}${unit}`;
      console.log(`📊 Performance: ${name} = ${formattedValue}`);
    } finally {
      isInterceptingConsole = false;
    }
  }

  // Note: Sentry performance measurement removed due to API changes
  // Can be re-added when Sentry API is updated
};

// Flush logs before page unload
export const flushLogs = async () => {
  if (batchTimeout) {
    clearTimeout(batchTimeout);
    batchTimeout = null;
  }
  await sendBatch();
};

// Set up page unload handler
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Synchronous flush for critical logs - bypass circuit breaker for final attempt
    if (logBatch.length > 0 && navigator.sendBeacon && monitoringConfig.elkUrl) {
      // Use sendBeacon for reliable delivery during page unload
      // Note: sendBeacon bypasses circuit breaker for final delivery attempt
      const blob = new Blob([JSON.stringify(logBatch)], { type: 'application/json' });
      navigator.sendBeacon(monitoringConfig.elkUrl, blob);
      logBatch = [];
    }
  });
}

// Basic performance observer for web vitals
export const initWebVitals = async (options: { isDevelopment?: boolean } = {}) => {
  const config = { ...monitoringConfig, ...options };
  
  if (config.isDevelopment) {
    isInterceptingConsole = true;
    try {
      console.log('📊 Web Vitals monitoring initialized (development mode)');
    } finally {
      isInterceptingConsole = false;
    }

    try {
      // Dynamic import of web-vitals
      const webVitalsModule = await import('web-vitals');
      webVitals = webVitalsModule;

      // Use the new web-vitals API (v5+)
      webVitals.onCLS((metric: any) => recordMetric('CLS', metric, 'unitless', { isDevelopment: config.isDevelopment }));
      webVitals.onFCP((metric: any) => recordMetric('FCP', metric, 'ms', { isDevelopment: config.isDevelopment }));
      webVitals.onLCP((metric: any) => recordMetric('LCP', metric, 'ms', { isDevelopment: config.isDevelopment }));
      webVitals.onTTFB((metric: any) => recordMetric('TTFB', metric, 'ms', { isDevelopment: config.isDevelopment }));
      // Note: FID is deprecated in web-vitals v5
    } catch (e) {
      isInterceptingConsole = true;
      try {
        console.warn('Web Vitals library not available - install web-vitals package');
      } finally {
        isInterceptingConsole = false;
      }
    }
  }
};

// Export circuit breaker utilities for monitoring/debugging
export const getLoggingCircuitState = () => loggingCircuit.getState();
export const resetLoggingCircuit = () => loggingCircuit.reset();