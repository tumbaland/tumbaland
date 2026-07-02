import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format for console (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define JSON format for production (structured logging)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Choose format based on environment
const isProduction = process.env.NODE_ENV === 'production';
const logFormat = isProduction ? jsonFormat : consoleFormat;

// Define which transports the logger must use
const transports: winston.transport[] = [
  // Console transport (goes to Docker stdout/stderr)
  new winston.transports.Console({
    format: logFormat,
    level: level()
  }),
];

// Add file transport only in development (optional)
if (!isProduction && process.env.LOG_TO_FILE === 'true') {

  // Create logs directory if it doesn't exist
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: jsonFormat,
      level: 'debug'
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;