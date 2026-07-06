// Utility functions for monitoring

// Generate correlation ID using crypto.randomUUID()
export const generateCorrelationId = (): string => {
  return crypto.randomUUID();
};

// Get or create a session ID (persistent across the user's session)
let sessionId: string | null = null;
export const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = generateCorrelationId();
  }
  return sessionId;
};

// Get correlation ID from server-set meta tag or generate request-specific ID
export const getCorrelationId = (): string => {
  // Try to get from server-set meta tag first (proxy-generated)
  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector('meta[name="x-correlation-id"]');
    if (metaTag && metaTag.getAttribute('content')) {
      return metaTag.getAttribute('content')!;
    }
  }

  // Fallback: generate per-request correlation ID
  return generateCorrelationId();
};