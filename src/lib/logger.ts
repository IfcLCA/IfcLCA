// Simple logger utility with different log levels and formatting
class Logger {
  private static formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataString}`;
  }

  info(message: string, data?: any) {
    console.log(Logger.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any) {
    console.warn(Logger.formatMessage('WARN', message, data));
  }

  error(message: string, data?: any) {
    console.error(Logger.formatMessage('ERROR', message, data));
  }

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(Logger.formatMessage('DEBUG', message, data));
    }
  }
}

export const logger = new Logger();
