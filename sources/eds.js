// dist/sources/eds.js
/**
 * Adobe Experience Manager (AEM) Data Source
 * Provides page lists from AEM GraphQL API for the Media Library component
 */

class AEMSource {
  constructor() {
    this.name = 'AEM Source';
    this.description = 'Discovers pages and assets via AEM GraphQL API';
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;
    
    // Check for AEM-specific patterns
    const aemPatterns = [
      /\/content\/dam\//,
      /\/content\/.*\.html$/,
      /\/graphql\/execute.json/,
      /\/system\/graphql/,
      /\/api\/graphql/
    ];
    
    return aemPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Get page list from AEM GraphQL API
   * @param {string} baseUrl - AEM site base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageList(baseUrl, options = {}) {
    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid AEM URL');
    }

    const {
      graphqlEndpoint = '/content/cq:graphql/endpoint.json',
      maxResults = 1000,
      contentPath = '/content'
    } = options;

    const graphqlUrl = this.getGraphQLUrl(baseUrl, graphqlEndpoint);
    const query = this.buildPageListQuery(contentPath, maxResults);

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      return this.parsePageListResult(result.data);
    } catch (error) {
      // Fallback to sitemap if GraphQL fails
      console.warn('GraphQL failed, falling back to sitemap:', error.message);
      return await this.getPageListFromSitemap(baseUrl);
    }
  }

  /**
   * Get GraphQL URL for AEM
   * @param {string} baseUrl - Base URL
   * @param {string} endpoint - GraphQL endpoint
   * @returns {string} Full GraphQL URL
   */
  getGraphQLUrl(baseUrl, endpoint) {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    return `${cleanUrl}${endpoint}`;
  }

  /**
   * Build GraphQL query for page list
   * @param {string} contentPath - Content path to query
   * @param {number} maxResults - Maximum results
   * @returns {string} GraphQL query
   */
  buildPageListQuery(contentPath, maxResults) {
    return `
      query {
        pageList(path: "${contentPath}", limit: ${maxResults}) {
          items {
            _path
            jcr:title
            jcr:created
            jcr:lastModified
            cq:template
            sling:resourceType
          }
        }
      }
    `;
  }

  /**
   * Parse GraphQL result into page objects
   * @param {Object} data - GraphQL result data
   * @returns {Array} Array of page objects
   */
  parsePageListResult(data) {
    if (!data?.pageList?.items) {
      return [];
    }

    return data.pageList.items.map(item => ({
      url: this.pathToUrl(item._path),
      loc: this.pathToUrl(item._path),
      lastmod: item['jcr:lastModified'],
      title: item['jcr:title'],
      path: item._path,
      template: item['cq:template'],
      resourceType: item['sling:resourceType']
    }));
  }

  /**
   * Convert AEM path to URL
   * @param {string} path - AEM content path
   * @returns {string} URL
   */
  pathToUrl(path) {
    if (!path) return '';
    
    // Convert AEM path to URL format
    let url = path.replace(/^\/content\//, '/');
    url = url.replace(/\.html$/, '');
    
    // Handle language-specific paths
    url = url.replace(/^\/[a-z]{2}\//, '/');
    
    return url;
  }

  /**
   * Fallback method to get page list from sitemap
   * @param {string} baseUrl - Base URL
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageListFromSitemap(baseUrl) {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const pages = [];
      const urlElements = xmlDoc.querySelectorAll('url > loc');
      
      for (const urlElement of urlElements) {
        const url = urlElement.textContent.trim();
        const urlElement_parent = urlElement.parentElement;
        
        const lastmodElement = urlElement_parent.querySelector('lastmod');
        const lastmod = lastmodElement ? lastmodElement.textContent.trim() : null;

        pages.push({
          url,
          loc: url,
          lastmod
        });
      }

      return pages;
    } catch (error) {
      throw new Error(`Failed to get page list from AEM: ${error.message}`);
    }
  }

  /**
   * Get asset list from AEM DAM
   * @param {string} baseUrl - AEM site base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of asset objects
   */
  async getAssetList(baseUrl, options = {}) {
    const {
      damPath = '/content/dam',
      maxResults = 1000
    } = options;

    const graphqlUrl = this.getGraphQLUrl(baseUrl, '/content/cq:graphql/endpoint.json');
    const query = this.buildAssetListQuery(damPath, maxResults);

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      return this.parseAssetListResult(result.data);
    } catch (error) {
      throw new Error(`Failed to get asset list from AEM: ${error.message}`);
    }
  }

  /**
   * Build GraphQL query for asset list
   * @param {string} damPath - DAM path to query
   * @param {number} maxResults - Maximum results
   * @returns {string} GraphQL query
   */
  buildAssetListQuery(damPath, maxResults) {
    return `
      query {
        assetList(path: "${damPath}", limit: ${maxResults}) {
          items {
            _path
            jcr:title
            jcr:lastModified
            jcr:content {
              mimeType
              width
              height
              size
            }
          }
        }
      }
    `;
  }

  /**
   * Parse GraphQL result into asset objects
   * @param {Object} data - GraphQL result data
   * @returns {Array} Array of asset objects
   */
  parseAssetListResult(data) {
    if (!data?.assetList?.items) {
      return [];
    }

    return data.assetList.items.map(item => ({
      url: this.pathToUrl(item._path),
      path: item._path,
      title: item['jcr:title'],
      lastmod: item['jcr:lastModified'],
      mimeType: item['jcr:content']?.mimeType,
      width: item['jcr:content']?.width,
      height: item['jcr:content']?.height,
      size: item['jcr:content']?.size
    }));
  }
}

export default AEMSource;
