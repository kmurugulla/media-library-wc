/**
 * Adobe Dynamic Media (Dynamic Assets) Data Source
 * Provides asset lists from Adobe Dynamic Media API with authentication
 */

class AdobeDASource {
  constructor() {
    this.name = 'Adobe Dynamic Assets Source';
    this.description = 'Discovers assets via Adobe Dynamic Media API with authentication';
    this.requireAuth = true;
    this.daOrigin = 'https://admin.da.live';
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;

    const adobePatterns = [
      /\/is\/image\//,
      /\/is\/video\//,
      /\/is\/content\//,
      /\/dynamicmedia\//,
      /\.scene7\.com/,
      /\.adobedtm\.com/,
    ];

    return adobePatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Get page list from Adobe DA using authenticated API
   * @param {string} baseUrl - Adobe DA base URL (can be org/repo format)
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageList(baseUrl, options = {}) {
    const {
      org,
      repo,
      requireAuth = true,
    } = options;

    if (org && repo) {
      return this.getPageListFromDA(org, repo);
    }

    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid Adobe DA URL');
    }

    if (requireAuth) {
      try {
        return this.getPageListFromDADiscovery(baseUrl);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('DA discovery failed, falling back to sitemap:', error.message);
      }
    }

    return this.getPageListFromSitemap(baseUrl);
  }

  /**
   * Fetch assets by type
   * @param {string} baseUrl - Base URL
   * @param {string} apiKey - API key
   * @param {string} companyId - Company ID
   * @param {string} assetType - Asset type (image, video, etc.)
   * @param {number} maxResults - Maximum results
   * @returns {Promise<Array>} Array of asset objects
   */
  async fetchAssetsByType(baseUrl, apiKey, companyId, assetType, maxResults) {
    const apiUrl = this.getApiUrl(baseUrl, companyId);
    const params = new URLSearchParams({
      api_key: apiKey,
      type: assetType,
      limit: Math.min(maxResults, 100),
      format: 'json',
    });

    try {
      const response = await fetch(`${apiUrl}/assets?${params}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MediaLibrary/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.assets) {
        return [];
      }

      return data.assets.map((asset) => this.convertAssetToPageObject(asset, baseUrl));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error fetching ${assetType} assets:`, error);
      return [];
    }
  }

  /**
   * Get API URL for Adobe Dynamic Media
   * @param {string} baseUrl - Base URL
   * @param {string} companyId - Company ID
   * @returns {string} API URL
   */
  getApiUrl(baseUrl, companyId) {
    const cleanUrl = baseUrl.replace(/\/$/, '');

    if (cleanUrl.includes('.scene7.com')) {
      return `${cleanUrl}/is/image/${companyId}`;
    } if (cleanUrl.includes('.adobedtm.com')) {
      return `${cleanUrl}/api/v1/companies/${companyId}`;
    }
    return `${cleanUrl}/api/v1/companies/${companyId}`;
  }

  /**
   * Convert Adobe asset to page object format
   * @param {Object} asset - Adobe asset object
   * @param {string} baseUrl - Base URL
   * @returns {Object} Page object
   */
  convertAssetToPageObject(asset, baseUrl) {
    const assetUrl = this.generateAssetUrl(asset, baseUrl);

    return {
      url: assetUrl,
      loc: assetUrl,
      lastmod: asset.lastModified || asset.created,
      title: asset.name || asset.title,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      size: asset.size,
      mimeType: asset.mimeType,
      id: asset.id,
      path: asset.path,
    };
  }

  /**
   * Generate asset URL for Adobe Dynamic Media
   * @param {Object} asset - Asset object
   * @param {string} baseUrl - Base URL
   * @returns {string} Asset URL
   */
  generateAssetUrl(asset, baseUrl) {
    const cleanUrl = baseUrl.replace(/\/$/, '');

    if (asset.type === 'image') {
      return `${cleanUrl}/is/image/${asset.path}`;
    } if (asset.type === 'video') {
      return `${cleanUrl}/is/video/${asset.path}`;
    }
    return `${cleanUrl}/is/content/${asset.path}`;
  }

  /**
   * Get page list from Adobe DA using authenticated API
   * @param {string} org - Adobe DA organization
   * @param {string} repo - Adobe DA repository
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageListFromDA(org, repo) {
    try {
      const isAuthenticated = await this.checkAuthentication();
      if (!isAuthenticated) {
        throw new Error('Authentication required. Please authenticate with Adobe DA first.');
      }

      const existingData = await this.loadExistingMediaData(org, repo);
      if (existingData && existingData.length > 0) {
        return existingData.map((item) => ({
          url: item.url,
          loc: item.url,
          lastmod: item.lastUsedAt || new Date().toISOString(),
          title: item.name,
          type: item.type,
          alt: item.alt,
          doc: item.doc,
        }));
      }

      const urls = await this.discoverDAContent(org, repo);

      return urls.map((url) => ({
        url,
        loc: url,
        lastmod: new Date().toISOString(),
        title: url.split('/').pop(),
        type: 'page',
      }));
    } catch (error) {
      throw new Error(`Adobe DA scan failed: ${error.message}`);
    }
  }

  /**
   * Get asset metadata
   * @param {string} assetUrl - Asset URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Asset metadata
   */
  async getAssetMetadata(assetUrl) {
    try {
      const response = await fetch(assetUrl, { method: 'HEAD' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        url: assetUrl,
        lastmod: response.headers.get('last-modified'),
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        etag: response.headers.get('etag'),
      };
    } catch (error) {
      throw new Error(`Failed to get asset metadata: ${error.message}`);
    }
  }

  /**
   * Generate optimized asset URL with parameters
   * @param {string} assetUrl - Base asset URL
   * @param {Object} params - Optimization parameters
   * @returns {string} Optimized asset URL
   */
  generateOptimizedUrl(assetUrl, params = {}) {
    const {
      width,
      height,
      quality = 80,
      format = 'auto',
      fit = 'constrain',
    } = params;

    const url = new URL(assetUrl);

    if (width) url.searchParams.set('wid', width);
    if (height) url.searchParams.set('hei', height);
    if (quality) url.searchParams.set('qlt', quality);
    if (format) url.searchParams.set('fmt', format);
    if (fit) url.searchParams.set('fit', fit);

    return url.toString();
  }

  /**
   * Check if user is authenticated for Adobe DA
   * @returns {Promise<boolean>} True if authenticated
   */
  async checkAuthentication() {
    try {
      if (localStorage.getItem('nx-ims')) {
        return true;
      }

      const testUrl = `${this.daOrigin}/source/test`;
      const response = await this.daFetch(testUrl, { method: 'HEAD' });

      return response.ok || response.status === 404;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Authentication check failed:', error.message);
      return false;
    }
  }

  /**
   * Load existing media data from Adobe DA
   * @param {string} org - Organization
   * @param {string} repo - Repository
   * @returns {Promise<Array>} Array of media data
   */
  async loadExistingMediaData(org, repo) {
    try {
      const mediaSheetPath = `/${org}/${repo}/.da/mediaindex/media.json`;
      const response = await this.daFetch(`${this.daOrigin}/source${mediaSheetPath}`);

      if (response.ok) {
        const data = await response.json();
        return data.data || data || [];
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load existing media data:', error.message);
    }
    return [];
  }

  /**
   * Discover Adobe DA content using crawl API
   * @param {string} org - Organization
   * @param {string} repo - Repository
   * @returns {Promise<Array>} Array of URLs
   */
  async discoverDAContent(org, repo) {
    const crawlPath = `/${org}/${repo}`;
    const urls = [];

    try {
      const crawlUrl = `${this.daOrigin}/source${crawlPath}`;
      const response = await this.daFetch(crawlUrl);

      if (response.ok) {
        const data = await response.json();

        if (data.children) {
          this.extractHtmlFiles(data.children, urls, crawlPath);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Crawl API failed, using fallback method:', error.message);
      urls.push(`${crawlPath}/index.html`);
    }

    return urls;
  }

  /**
   * Extract HTML files from crawl results
   * @param {Array} children - Children items from crawl
   * @param {Array} urls - URLs array to populate
   * @param {string} basePath - Base path
   */
  extractHtmlFiles(children, urls, basePath) {
    children.forEach((child) => {
      if (child.type === 'file' && child.name.endsWith('.html')) {
        urls.push(`${basePath}/${child.name}`);
      } else if (child.type === 'directory' && child.children) {
        this.extractHtmlFiles(child.children, urls, `${basePath}/${child.name}`);
      }
    });
  }

  /**
   * Get page list from DA discovery for direct URLs
   * @param {string} baseUrl - Base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageListFromDADiscovery(baseUrl) {
    const urlMatch = baseUrl.match(/https?:\/\/main--([^--]+)--([^.]+)\.da\.page/);
    if (urlMatch) {
      const [, repo, org] = urlMatch;
      return this.getPageListFromDA(org, repo);
    }

    throw new Error('Cannot extract org/repo from URL for DA discovery');
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
        const urlElementParent = urlElement.parentElement;

        const lastmodElement = urlElementParent.querySelector('lastmod');
        const lastmod = lastmodElement ? lastmodElement.textContent.trim() : null;

        pages.push({
          url,
          loc: url,
          lastmod,
        });
      }

      return pages;
    } catch (error) {
      throw new Error(`Failed to get page list from Adobe DA: ${error.message}`);
    }
  }

  /**
   * Authenticated fetch wrapper (similar to daFetch from Franklin)
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async daFetch(url, options = {}) {
    options.headers ||= {};

    if (localStorage.getItem('nx-ims')) {
      try {
        const token = await this.getIMSToken();
        if (token) {
          options.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to get IMS token:', error.message);
      }
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
      throw new Error('Authentication required. Please sign in to Adobe DA.');
    }

    return response;
  }

  /**
   * Get IMS token (simplified version)
   * @returns {Promise<string|null>} IMS token or null
   */
  async getIMSToken() {
    if (window.adobeIMS && window.adobeIMS.getAccessToken) {
      return window.adobeIMS.getAccessToken()?.token;
    }
    return null;
  }
}

export default AdobeDASource;
