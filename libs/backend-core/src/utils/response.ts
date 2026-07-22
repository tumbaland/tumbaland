import { Response } from 'express';

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  correlationId?: string;
}

/**
 * Create a standardized API response
 */
export function createApiResponse<T = unknown>(
  success: boolean,
  data?: T,
  message?: string,
  error?: string,
  correlationId?: string
): ApiResponse<T> {
  const response: ApiResponse<T> = { success };

  if (data !== undefined) response.data = data;
  if (message) response.message = message;
  if (error) response.error = error;
  if (correlationId) response.correlationId = correlationId;

  return response;
}

/**
 * Send a success response
 */
export function sendSuccess<T = unknown>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200,
  correlationId?: string
) {
  const response = createApiResponse(true, data, message, undefined, correlationId);
  res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: string,
  correlationId?: string
) {
  const response = createApiResponse(false, undefined, message, error, correlationId);
  res.status(statusCode).json(response);
}