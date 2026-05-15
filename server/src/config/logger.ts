import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const fmt = printf(({ level, message, timestamp: ts, stack }) =>
  `${ts} [${level.toUpperCase()}]: ${stack ?? message}`
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), fmt),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), fmt),
      silent: process.env.NODE_ENV === 'test',
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10_485_760, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/app.log',   maxsize: 10_485_760, maxFiles: 10 }),
  ],
});
