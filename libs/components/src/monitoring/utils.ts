// Utility functions for monitoring

// Generate correlation ID using crypto.randomUUID() for better uniqueness
export const generateCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'frontend-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

// Get correlation ID from server-set meta tag or generate fallback
export const getCorrelationId = (): string => {
  // Try to get from server-set meta tag first
  if (typeof document !== 'undefined') {
    const metaTag = document.querySelector('meta[name="x-correlation-id"]');
    if (metaTag && metaTag.getAttribute('content')) {
      return metaTag.getAttribute('content')!;
    }
  }

  // Fallback to session-based ID for client-side logging
  return getSessionCorrelationId();
};

// Get or create a session correlation ID (fallback)
let sessionCorrelationId: string | null = null;
export const getSessionCorrelationId = (): string => {
  if (!sessionCorrelationId) {
    sessionCorrelationId = generateCorrelationId();
  }
  return sessionCorrelationId;
};

// Enhanced fetch with correlation ID headers
export const fetchWithCorrelation = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const correlationId = getCorrelationId();
  const headers = new Headers(options.headers);

  // Add correlation ID if not already present
  if (!headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', correlationId);
  }

  return fetch(url, {
    ...options,
    headers
  });
};