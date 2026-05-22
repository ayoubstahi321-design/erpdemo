type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private enabled = import.meta.env.MODE === 'development';

  debug(message: string, data?: any): void {
    if (this.enabled) {
      console.debug(`[DEBUG] ${message}`, data !== undefined ? data : '');
    }
  }

  info(message: string, data?: any): void {
    if (this.enabled) {
      console.info(`[INFO] ${message}`, data !== undefined ? data : '');
    }
  }

  warn(message: string, data?: any): void {
    // warn and error always log (even in production) for diagnosing auth/session issues
    console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
  }

  error(message: string, error?: any): void {
    // Always log errors regardless of environment
    console.error(`[ERROR] ${message}`, error || '');
  }

  auth(message: string, userId?: string, data?: any): void {
    if (this.enabled) {
      const userInfo = userId ? ` [User: ${userId}]` : '';
      console.log(`🔐 [AUTH]${userInfo} ${message}`, data !== undefined ? data : '');
    }
  }
}

export const logger = new Logger();
