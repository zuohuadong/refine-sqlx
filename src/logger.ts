/**
 * Logger interface for refine-sqlx
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private enabled: boolean = false) {}

  debug(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.debug(`[refine-sqlx] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.info(`[refine-sqlx] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.warn(`[refine-sqlx] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(`[refine-sqlx] ${message}`, ...args);
    }
  }
}

/**
 * No-op logger (disabled logging)
 */
export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Create a logger instance based on configuration
 */
export function createLogger(enabled: boolean | Logger): Logger {
  if (typeof enabled === 'boolean') {
    return enabled ? new ConsoleLogger(true) : new NoOpLogger();
  }
  return enabled;
}
