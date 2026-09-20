// Batch logging system for efficient log transmission

import { getMonitoringConfig, MonitoringLog } from './config';

// Log batching for better performance
let logBatch: MonitoringLog[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000; // 5 seconds

// Send batched logs
const sendBatch = async () => {
  if (logBatch.length === 0) return;

  const config = getMonitoringConfig();
  if (!config.elkUrl) return;

  const batchToSend = [...logBatch];
  logBatch = [];

  try {
    const response = await fetch(config.elkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batchToSend)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    // Report the failure without it becoming a log of its own. console.warn is
    // usually the interceptor, which captures and queues whatever passes through
    // it; saving a reference to it and swapping in a no-op did not stop that.
    // Each failure then queued one warning plus, in development, one per dropped
    // log, which refilled the batch past BATCH_SIZE and sent again at once. With
    // the endpoint down that never paused and ran the page out of memory.
    // The interceptor still prints while this flag is set; it just captures nothing.
    const wasIntercepting = window._monitoringInterceptingConsole === true;
    window._monitoringInterceptingConsole = true;
    try {
      console.warn('Failed to send log batch, dropping logs:', error);
      if (config.isDevelopment) {
        batchToSend.forEach((log) => {
          console.warn('📝 [DROPPED LOG]:', JSON.stringify(log));
        });
      }
    } finally {
      window._monitoringInterceptingConsole = wasIntercepting;
    }
  }
};

// Queue log for batching
export const queueLog = (logData: MonitoringLog) => {
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
    // Synchronous flush for critical logs - use sendBeacon for reliable delivery during page unload
    const config = getMonitoringConfig();
    if (logBatch.length > 0 && navigator.sendBeacon && config.elkUrl) {
      // Use sendBeacon for reliable delivery during page unload
      const blob = new Blob([JSON.stringify(logBatch)], { type: 'application/json' });
      navigator.sendBeacon(config.elkUrl, blob);
      logBatch = [];
    }
  });
}
