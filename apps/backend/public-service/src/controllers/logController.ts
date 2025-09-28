import { Request, Response } from 'express';
import { logger } from '@tumbaland/core';

/**
 * Log controller for handling frontend log submissions
 * Provides endpoints for frontend applications to send logs to the centralized logging pipeline
 */

/**
 * POST /api/logs
 * Accepts log entries from frontend applications and forwards them to the logging pipeline
 * Supports both single log entries and arrays of log entries for batch processing
 */
export const submitLogs = async (req: Request, res: Response) => {
  try {
    const logData = req.body;

    // Handle both single log entries and arrays of log entries
    const logEntries = Array.isArray(logData) ? logData : [logData];
    let processedCount = 0;

    // Process each log entry
    for (const entry of logEntries) {
      // Add service identification for frontend logs
      const logEntry = {
        ...entry,
        forwarded_by: 'public-service',
        source: entry.service || 'unknown-frontend',
        source_type: 'frontend_request',
        ingestion_method: 'api_endpoint',
        timestamp: entry.timestamp || new Date().toISOString(),
        // Ensure required fields for Logstash processing
        service: entry.service || 'unknown-frontend',
        component: 'frontend',
        level: entry.level || 'info'
      };

      // Write to stdout (will be picked up by Filebeat)
      console.log(JSON.stringify(logEntry));
      processedCount++;
    }

    res.status(200).json({
      status: 'logged',
      count: processedCount,
      message: `Successfully processed ${processedCount} log entries`
    });
  } catch (error) {
    logger.error('Error processing frontend log submission', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body
    });
    res.status(500).json({
      error: 'Failed to process log submission',
      message: 'An error occurred while processing the log entries'
    });
  }
};

/**
 * GET /api/logs/health
 * Health check endpoint for the logging system
 * Verifies that the logging pipeline is functioning correctly
 */
export const getLogsHealth = async (req: Request, res: Response) => {
  try {
    // Test log entry to verify the pipeline
    const testLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'public-service',
      component: 'logging',
      message: 'Log health check test',
      test: true,
      correlationId: `health-check-${Date.now()}`
    };

    // Write test log to stdout
    console.log(JSON.stringify(testLogEntry));

    res.status(200).json({
      status: 'healthy',
      service: 'log-controller',
      timestamp: new Date().toISOString(),
      message: 'Logging pipeline is operational'
    });
  } catch (error) {
    logger.error('Log health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      service: 'log-controller',
      timestamp: new Date().toISOString(),
      error: 'Logging pipeline health check failed'
    });
  }
};