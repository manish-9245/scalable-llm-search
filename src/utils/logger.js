import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
});

/**
 * Creates a child logger with a common traceId.
 * Used to track the entire chain of events for a single request.
 */
export const getChildLogger = (traceId) => {
  return logger.child({ traceId });
};

// Default logger for global events
export const log = {
  info: (msg, obj = {}) => logger.info(obj, msg),
  warn: (msg, obj = {}) => logger.warn(obj, msg),
  error: (msg, obj = {}, err = null) => {
    if (err) obj.err = err;
    logger.error(obj, msg);
  },
  debug: (msg, obj = {}) => logger.debug(obj, msg),
};
