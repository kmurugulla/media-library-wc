/**
 * Adobe Experience Manager (AEM) EDS Data Source
 * Provides page lists from AEM using EDS (Experience Data Sources) API with authentication
 */

class EDSSource {
  constructor() {
    this.name = 'EDS Source';
    this.description = 'Discovers pages and assets via AEM EDS API with authentication';
    this.requireAuth = true;
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;

    const aemPatterns = [
      /\/content\/dam\//,
      /\/content\/.*\.html$/,
      /\/graphql\/execute.json/,
      /\/system\/graphql/,
      /\/api\/graphql/,
    ];

    return aemPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Get page list from AEM using EDS API with authentication
   * @param {string} baseUrl - AEM site base URL (can be org/repo format)
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
      return this.getPageListFromEDS(org, repo);
    }

    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid AEM URL');
    }

    if (requireAuth) {
      try {
        return this.getPageListFromEDSDiscovery(baseUrl);
      } catch (error) {
        console.warn('EDS discovery failed, falling back to sitemap:', error.message);
      }
    }

    return this.getPageListFromSitemap(baseUrl);
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

    return data.pageList.items.map((item) => ({
      url: this.pathToUrl(item._path),       loc: this.pathToUrl(item._path),       lastmod: item['jcr:lastModified'],
      title: item['jcr:title'],
      path: item._path,       template: item['cq:template'],
      resourceType: item['sling:resourceType'],
    }));
  }

  /**
   * Convert AEM path to URL
   * @param {string} path - AEM content path
   * @returns {string} URL
   */
  pathToUrl(path) {
    if (!path) return '';

    let url = path.replace(/^\/content\//, '/');
    url = url.replace(/\.html$/, '');

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
      maxResults = 1000,
    } = options;

    const graphqlUrl = this.getGraphQLUrl(baseUrl, '/content/cq:graphql/endpoint.json');
    const query = this.buildAssetListQuery(damPath, maxResults);

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
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

    return data.assetList.items.map((item) => ({
      url: this.pathToUrl(item._path),       path: item._path,       title: item['jcr:title'],
      lastmod: item['jcr:lastModified'],
      mimeType: item['jcr:content']?.mimeType,
      width: item['jcr:content']?.width,
      height: item['jcr:content']?.height,
      size: item['jcr:content']?.size,
    }));
  }

  /**
   * Get page list from AEM using EDS API with authentication
   * @param {string} org - AEM organization
   * @param {string} repo - AEM repository
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageListFromEDS(org, repo) {
    try {
      const isAuthenticated = await this.checkAuthentication(org, repo);
      if (!isAuthenticated) {
        throw new Error('Authentication required. Please authenticate with AEM first.');
      }

      const urls = await this.discoverAEMContent(org, repo);

      return urls.map((url) => ({
        url,
        loc: url,
        lastmod: new Date().toISOString(),
      }));
    } catch (error) {
      throw new Error(`EDS scan failed: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated for the given org/repo
   * @param {string} org - Organization
   * @param {string} repo - Repository
   * @returns {Promise<boolean>} True if authenticated
   */
  async checkAuthentication(org, repo) {
    try {
      if (window.messageSidekick) {
        const authInfo = await new Promise((resolve) => {
          window.messageSidekick({ action: 'getAuthInfo' }, (res) => resolve(res));
          setTimeout(() => resolve(null), 200);
        });

        if (authInfo && Array.isArray(authInfo) && authInfo.includes(org)) {
          return true;
        }
      }

      const statusUrl = `https://admin.hlx.page/status/${org}/${repo}/main/*`;
      const response = await fetch(statusUrl, {
        method: 'HEAD',
        mode: 'cors',
        credentials: 'same-origin',
      });

      return response.ok;
    } catch (error) {
      console.warn('Authentication check failed:', error.message);
      return false;
    }
  }

  /**
   * Discover AEM content using EDS API
   * @param {string} org - Organization
   * @param {string} repo - Repository
   * @returns {Promise<Array>} Array of URLs
   */
  async discoverAEMContent(org, repo) {
    const statusUrl = `https://admin.hlx.page/status/${org}/${repo}/main/*`;

    const statusResp = await fetch(statusUrl, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({
        paths: ['/*'],
        select: ['edit', 'preview', 'live'],
      }),
    });

    if (!statusResp.ok) {
      throw new Error(`Status job failed: ${statusResp.status}`);
    }

    const statusData = await statusResp.json();

    let selfReference = null;
    if (statusData.links && statusData.links.self) {
      selfReference = statusData.links.self;
    } else if (statusData.job && statusData.job.links && statusData.job.links.self) {
      selfReference = statusData.job.links.self;
    } else if (statusData.self) {
      selfReference = statusData.self;
    }

    if (!selfReference) {
      throw new Error('No job reference returned');
    }

    const jobUrl = await this.pollJobCompletion(selfReference);
    const detailsUrl = `${jobUrl}/details`;
    const detailsResp = await fetch(detailsUrl);

    if (!detailsResp.ok) {
      throw new Error(`Details fetch failed: ${detailsResp.status}`);
    }

    const detailsData = await detailsResp.json();

    return detailsData.data.resources.map((resource) => ({
      loc: `https://main--${repo}--${org}.aem.page${resource.path}`,
      lastmod: new Date().toISOString(),
    }));
  }

  /**
   * Poll job completion
   * @param {string} jobUrl - Job URL
   * @param {number} retry - Retry interval
   * @returns {Promise<string>} Completed job URL
   */
  async pollJobCompletion(jobUrl, retry = 2000) {
    const jobRes = await fetch(jobUrl);
    if (!jobRes.ok) {
      throw new Error(`Job polling failed: ${jobRes.status}`);
    }

    const jobData = await jobRes.json();
    const state = jobData.job ? jobData.job.state : jobData.state;

    if (state !== 'completed' && state !== 'stopped') {
      await new Promise((resolve) => {
        setTimeout(resolve, retry);
      });
      return this.pollJobCompletion(jobUrl, retry);
    }

    return jobUrl;
  }

  /**
   * Get page list from EDS discovery for direct URLs
   * @param {string} baseUrl - Base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageListFromEDSDiscovery(baseUrl) {
    const urlMatch = baseUrl.match(/https?:\/\/main--([^--]+)--([^.]+)\.aem\.page/);
    if (urlMatch) {
      const [, repo, org] = urlMatch;
      return this.getPageListFromEDS(org, repo);
    }

    throw new Error('Cannot extract org/repo from URL for EDS discovery');
  }
}

export default EDSSource;
