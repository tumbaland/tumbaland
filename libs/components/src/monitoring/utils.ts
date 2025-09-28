// Utility functions for monitoring

// Utility function to generate correlation IDs
export const generateCorrelationId = (): string => {
  return 'frontend-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};