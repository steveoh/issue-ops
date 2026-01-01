/**
 * Logger service for consistent logging across the application
 * Respects NODE_ENV for test silencing
 */
export class Logger {
  /**
   * Log informational message
   * Silenced when NODE_ENV includes 'test'
   */
  info(message: string, ...args: unknown[]): void {
    if (!process.env.NODE_ENV?.includes('test')) {
      console.log(message, ...args);
    }
  }

  /**
   * Log warning message
   * Silenced when NODE_ENV includes 'test'
   */
  warn(message: string, ...args: unknown[]): void {
    if (!process.env.NODE_ENV?.includes('test')) {
      console.warn(message, ...args);
    }
  }

  /**
   * Log error message
   * Silenced when NODE_ENV includes 'test'
   */
  error(message: string, ...args: unknown[]): void {
    if (!process.env.NODE_ENV?.includes('test')) {
      console.error(message, ...args);
    }
  }

  /**
   * Log debug message (always uses console.log)
   * Only shown when DEBUG environment variable is set
   */
  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG && !process.env.NODE_ENV?.includes('test')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export legacy functions for backward compatibility
export function log(...args: unknown[]): void {
  logger.info(String(args[0] ?? ''), ...args.slice(1));
}

export function warn(...args: unknown[]): void {
  logger.warn(String(args[0] ?? ''), ...args.slice(1));
}

export function logError(...args: unknown[]): void {
  logger.error(String(args[0] ?? ''), ...args.slice(1));
}
