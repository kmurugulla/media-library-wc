// dist/sources/adobe-da.js
/**
 * Adobe Dynamic Media (Dynamic Assets) Data Source
 * Provides asset lists from Adobe Dynamic Media API for the Media Library component
 */

class AdobeDASource {
  constructor() {
    this.name = 'Adobe Dynamic Assets Source';
    this.description = 'Discovers assets via Adobe Dynamic Media API';
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;
    
    // Check for Adobe Dynamic Media patterns
    const adobePatterns = [
      /\/is\/image\//,
      /\/is\/video\//,
      /\/is\/content\//,
      /\/dynamicmedia\//,
      /\.scene7\.com/,
      /\.adobedtm\.com/
    ];
    
    return adobePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Get asset list from Adobe Dynamic Media
   * @param {string} baseUrl - Adobe Dynamic Media base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of asset objects
   */
  async getAssetList(baseUrl, options = {}) {
    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid Adobe Dynamic Media URL');
    }

    const {
      apiKey,
      companyId,
      maxResults = 1000,
      assetTypes = ['image', 'video']
    } = options;

    if (!apiKey || !companyId) {
      throw new Error('API key and company ID are required for Adobe Dynamic Media');
    }

    try {
      const assets = [];
      
      for (const assetType of assetTypes) {
        const typeAssets = await this.fetchAssetsByType(baseUrl, apiKey, companyId, assetType, maxResults);
        assets.push(...typeAssets);
      }

      return assets;
    } catch (error) {
      throw new Error(`Failed to get asset list from Adobe Dynamic Media: ${error.message}`);
    }
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
      limit: Math.min(maxResults, 100), // API limit
      format: 'json'
    });

    try {
      const response = await fetch(`${apiUrl}/assets?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MediaLibrary/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.assets) {
        return [];
      }

      return data.assets.map(asset => this.convertAssetToPageObject(asset, baseUrl));
    } catch (error) {
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
    
    // Handle different Adobe Dynamic Media URL formats
    if (cleanUrl.includes('.scene7.com')) {
      return `${cleanUrl}/is/image/${companyId}`;
    } else if (cleanUrl.includes('.adobedtm.com')) {
      return `${cleanUrl}/api/v1/companies/${companyId}`;
    } else {
      return `${cleanUrl}/api/v1/companies/${companyId}`;
    }
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
      path: asset.path
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
    } else if (asset.type === 'video') {
      return `${cleanUrl}/is/video/${asset.path}`;
    } else {
      return `${cleanUrl}/is/content/${asset.path}`;
    }
  }

  /**
   * Get page list (for compatibility with Media Library)
   * This method converts assets to page format
   * @param {string} baseUrl - Adobe Dynamic Media base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageList(baseUrl, options = {}) {
    const assets = await this.getAssetList(baseUrl, options);
    
    // Convert assets to page objects
    return assets.map(asset => ({
      url: asset.url,
      loc: asset.loc,
      lastmod: asset.lastmod,
      title: asset.title,
      type: 'asset',
      assetType: asset.type,
      width: asset.width,
      height: asset.height,
      size: asset.size,
      mimeType: asset.mimeType
    }));
  }

  /**
   * Get asset metadata
   * @param {string} assetUrl - Asset URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Asset metadata
   */
  async getAssetMetadata(assetUrl, options = {}) {
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
        etag: response.headers.get('etag')
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
      fit = 'constrain'
    } = params;

    const url = new URL(assetUrl);
    
    if (width) url.searchParams.set('wid', width);
    if (height) url.searchParams.set('hei', height);
    if (quality) url.searchParams.set('qlt', quality);
    if (format) url.searchParams.set('fmt', format);
    if (fit) url.searchParams.set('fit', fit);

    return url.toString();
  }
}

export default AdobeDASource;
