
class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.isDevelopment = this.isDevelopmentEnvironment();
  }

  getLogLevel() {
    const envLevel = typeof process !== 'undefined' && process.env?.LOG_LEVEL;
    if (envLevel) {
      return envLevel.toLowerCase();
    }

    return this.isDevelopmentEnvironment() ? 'debug' : 'info';
  }

  isDevelopmentEnvironment() {
    return (
      (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
      || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
      || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'dev')
    );
  }

  shouldLog(level) {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  log(message, ...args) {
    this.info(message, ...args);
  }

  logWithContext(context, level, message, ...args) {
    const contextMessage = `[${context}] ${message}`;
    this[level](contextMessage, ...args);
  }

  setLogLevel(level) {
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (validLevels.includes(level.toLowerCase())) {
      this.logLevel = level.toLowerCase();
    } else {
      this.warn(`Invalid log level: ${level}. Valid levels are: ${validLevels.join(', ')}`);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  createContextLogger(context) {
    return {
      error: (message, ...args) => this.logWithContext(context, 'error', message, ...args),
      warn: (message, ...args) => this.logWithContext(context, 'warn', message, ...args),
      info: (message, ...args) => this.logWithContext(context, 'info', message, ...args),
      debug: (message, ...args) => this.logWithContext(context, 'debug', message, ...args),
      log: (message, ...args) => this.logWithContext(context, 'info', message, ...args),
    };
  }
}

const logger = new Logger();

export default logger;

export { Logger };
