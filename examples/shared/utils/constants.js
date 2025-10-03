const CONFIG = {
  THROTTLE_DELAY: 50,
  MAX_CONCURRENCY: 20,
  DEFAULT_TIMEOUT: 5000,
  PROGRESSIVE_LIMITS: {
    GRID: 500,
    LIST: 750,
  },
  STORAGE_TYPES: {
    INDEXEDDB: 'indexeddb',
    R2: 'r2',
    NONE: 'none',
  },
  NOTIFICATION_TYPES: {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error',
  },
  CORS_PROXY_URL: 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/',
  DEFAULT_STORAGE: 'indexeddb',
  DEFAULT_LOCALE: 'en',
  NOTIFICATION_DURATION: 3000,
  NOTIFICATION_ANIMATION_DELAY: 100,
  NOTIFICATION_REMOVE_DELAY: 300,
};

export default CONFIG;
