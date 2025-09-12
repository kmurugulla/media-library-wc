// dist/sources/index.js
/**
 * Data Sources Index
 * Exports all available data sources for the Media Library component
 */

import SitemapSource from './sitemap.js';
import WordPressSource from './wordpress.js';
import AEMSource from './eds.js';
import AdobeDASource from './adobe-da.js';

/**
 * Data Sources Registry
 * Contains all available data sources with their metadata
 */
export const dataSources = {
  sitemap: {
    class: SitemapSource,
    name: 'Sitemap Source',
    description: 'Discovers and parses XML sitemaps to extract page lists',
    supportedTypes: ['website', 'sitemap'],
    defaultOptions: {}
  },
  wordpress: {
    class: WordPressSource,
    name: 'WordPress Source',
    description: 'Discovers pages and posts via WordPress REST API',
    supportedTypes: ['wordpress', 'wp-api'],
    defaultOptions: {
      postTypes: ['posts', 'pages'],
      perPage: 100,
      maxPages: 10
    }
  },
  aem: {
    class: AEMSource,
    name: 'AEM Source',
    description: 'Discovers pages and assets via AEM GraphQL API',
    supportedTypes: ['aem', 'adobe-experience-manager'],
    defaultOptions: {
      graphqlEndpoint: '/content/cq:graphql/endpoint.json',
      maxResults: 1000,
      contentPath: '/content'
    }
  },
  'adobe-da': {
    class: AdobeDASource,
    name: 'Adobe Dynamic Assets Source',
    description: 'Discovers assets via Adobe Dynamic Media API',
    supportedTypes: ['adobe-dynamic-media', 'scene7'],
    defaultOptions: {
      maxResults: 1000,
      assetTypes: ['image', 'video']
    }
  }
};

/**
 * Get data source by name
 * @param {string} name - Data source name
 * @returns {Object|null} Data source configuration or null if not found
 */
export function getDataSource(name) {
  return dataSources[name] || null;
}

/**
 * Get all available data sources
 * @returns {Object} All data sources
 */
export function getAllDataSources() {
  return dataSources;
}

/**
 * Get data source names
 * @returns {Array<string>} Array of data source names
 */
export function getDataSourceNames() {
  return Object.keys(dataSources);
}

/**
 * Create data source instance
 * @param {string} name - Data source name
 * @returns {Object|null} Data source instance or null if not found
 */
export function createDataSource(name) {
  const sourceConfig = getDataSource(name);
  if (!sourceConfig) {
    return null;
  }
  
  return new sourceConfig.class();
}

/**
 * Auto-detect data source for a given URL
 * @param {string} url - URL to analyze
 * @returns {string|null} Data source name or null if no match
 */
export function detectDataSource(url) {
  if (!url) return null;
  
  for (const [name, config] of Object.entries(dataSources)) {
    const instance = new config.class();
    if (instance.canHandle && instance.canHandle(url)) {
      return name;
    }
  }
  
  return null;
}

/**
 * Get data source recommendations for a URL
 * @param {string} url - URL to analyze
 * @returns {Array<Object>} Array of recommended data sources with scores
 */
export function getDataSourceRecommendations(url) {
  if (!url) return [];
  
  const recommendations = [];
  
  for (const [name, config] of Object.entries(dataSources)) {
    const instance = new config.class();
    if (instance.canHandle && instance.canHandle(url)) {
      recommendations.push({
        name,
        config,
        score: 1.0,
        reason: 'Direct URL match'
      });
    }
  }
  
  // Add sitemap as fallback recommendation
  if (recommendations.length === 0) {
    const sitemapConfig = dataSources.sitemap;
    recommendations.push({
      name: 'sitemap',
      config: sitemapConfig,
      score: 0.5,
      reason: 'Fallback option - may work with sitemap discovery'
    });
  }
  
  return recommendations.sort((a, b) => b.score - a.score);
}

// Export individual data sources
export { SitemapSource, WordPressSource, AEMSource, AdobeDASource };

// Export default as the registry
export default dataSources;
