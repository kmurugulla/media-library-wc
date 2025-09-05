// src/index.js
import './components/media-library.js';

// Export the main component for external use
export { default as MediaLibrary } from './components/media-library.js';

// Export utilities for advanced usage
export { BrowserStorage } from './utils/storage.js';
export { SitemapParser } from './utils/sitemap-parser.js';
export { i18n } from './utils/i18n.js';
export * from './utils/filters.js';
export * from './utils/utils.js';

// Include debug utilities in development
if (import.meta.env.DEV) {
  import('./utils/debug-storage.js');
}
