// src/sources/sitemap.js
/**
 * Sitemap Data Source
 * Provides page lists from XML sitemaps for the Media Library component
 */

class SitemapSource {
  constructor() {
    this.name = 'Sitemap Source';
    this.description = 'Discovers and parses XML sitemaps to extract page lists';
    this.commonSitemapPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap-index.xml',
      '/sitemaps.xml',
      '/sitemap/sitemap.xml',
      '/sitemap/index.xml',
      '/robots.txt',
    ];
    this.contentOrigin = null;
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;
    
    // Check if it's a sitemap URL
    if (url.includes('/sitemap') || url.endsWith('.xml')) {
      return true;
    }
    
    // Check if it's a website URL (we can auto-detect sitemap)
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return urlPattern.test(url);
  }

  /**
   * Get page list from sitemap
   * @param {string} source - Source URL (website or sitemap)
   * @param {string} sitemapUrl - Optional specific sitemap URL
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageList(source, sitemapUrl = null) {
    if (!this.canHandle(source)) {
      throw new Error('Invalid source URL for sitemap discovery');
    }

    let targetSitemapUrl = source;
    
    if (sitemapUrl && sitemapUrl.trim()) {
      // Use provided sitemap URL
      targetSitemapUrl = sitemapUrl;
    } else if (this.isWebsiteUrl(source)) {
      // Auto-detect sitemap for website URL
      targetSitemapUrl = await this.autoDetectSitemap(source);
    }

    return await this.parseSitemap(targetSitemapUrl);
  }

  /**
   * Check if URL is a website URL (not a sitemap)
   * @param {string} url - URL to check
   * @returns {boolean} True if it's a website URL
   */
  isWebsiteUrl(url) {
    if (!url) return false;
    
    if (url.includes('/sitemap') || url.endsWith('.xml')) {
      return false;
    }
    
    // Check if it's a domain (with or without protocol)
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return urlPattern.test(url);
  }

  async autoDetectSitemap(websiteUrl) {
    const urlVariations = this.generateUrlVariations(websiteUrl);
    for (const baseUrl of urlVariations) {
      try {
        this.contentOrigin = baseUrl;

        const sitemapFromRobots = await this.findSitemapInRobots(baseUrl);
        if (sitemapFromRobots) {
          return sitemapFromRobots;
        }
        for (const path of this.commonSitemapPaths) {
          if (path !== '/robots.txt') {
            const sitemapUrl = `${baseUrl}${path}`;
            try {
              const response = await fetch(sitemapUrl, { method: 'HEAD' });
              if (response?.ok) {
                return sitemapUrl;
              }
            } catch (error) {
              // Continue to next path
            }
          }
        }
      } catch (error) {
        // Continue to next URL variation
      }
    }

    for (const baseUrl of urlVariations) {
      try {
        this.contentOrigin = baseUrl;
        return await this.createFallbackPageList(baseUrl);
      } catch (error) {
        // Continue to next URL variation
      }
    }

    throw new Error(
      `No sitemap found and unable to create fallback page list for any URL variation of: ${websiteUrl}`,
    );
  }

  normalizeWebsiteUrl(url) {
    let normalizedUrl = url.trim();

    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    return normalizedUrl;
  }

  generateUrlVariations(url) {
    let domain = url.trim();

    domain = domain.replace(/^https?:\/\//, '');

    const baseDomain = domain.replace(/^www\./, '');
    const variations = [
      `https://${baseDomain}`,
      `https://www.${baseDomain}`,
      `http://${baseDomain}`,
      `http://www.${baseDomain}`,
    ];

    return [...new Set(variations)];
  }

  async findSitemapInRobots(baseUrl) {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;

      const response = await fetch(robotsUrl);
      if (!response.ok) {
        return null;
      }

      const robotsText = await response.text();
      const sitemapMatches = robotsText.match(/^Sitemap:\s*(.+)$/gim);

      if (sitemapMatches && sitemapMatches.length > 0) {
        const sitemapUrl = sitemapMatches[0].replace(/^Sitemap:\s*/i, '').trim();
        return sitemapUrl;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async createFallbackPageList(baseUrl) {
    let commonPages = [
      '/',
      '/about',
      '/contact',
      '/blog',
      '/news',
      '/articles',
      '/stories',
      '/posts',
      '/archive',
      '/search',
    ];

    if (baseUrl.includes('medium.com')) {
      commonPages = [
        '/',
        '/@medium',
        '/topic/technology',
        '/topic/programming',
        '/topic/design',
        '/topic/business',
        '/topic/productivity',
        '/topic/startup',
        '/topic/artificial-intelligence',
        '/topic/web-development',
      ];
    }

    try {
      const response = await fetch(baseUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Cannot access ${baseUrl}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Cannot access ${baseUrl}. This might be due to CORS restrictions or the site blocking requests. ${error.message}`,
      );
    }

    return {
      type: 'fallback',
      baseUrl,
      pages: commonPages.map((page) => ({
        loc: `${baseUrl}${page}`,
        lastmod: new Date().toISOString(),
      })),
    };
  }

  async parseSitemap(sitemapUrl) {
    if (sitemapUrl && typeof sitemapUrl === 'object' && sitemapUrl.type === 'fallback') {
      return sitemapUrl.pages;
    }

    const response = await fetch(sitemapUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const sitemapText = await response.text();
    const parser = new DOMParser();
    const sitemapDoc = parser.parseFromString(sitemapText, 'text/xml');

    const parserError = sitemapDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid XML in sitemap');
    }

    return this.extractUrls(sitemapDoc);
  }

  async extractUrls(sitemapDoc) {
    const urls = [];

    const urlElements = sitemapDoc.querySelectorAll('url');
    urlElements.forEach((urlElement) => {
      const loc = urlElement.querySelector('loc');
      const lastmod = urlElement.querySelector('lastmod');

      if (loc && loc.textContent) {
        urls.push({
          loc: loc.textContent.trim(),
          lastmod: lastmod ? lastmod.textContent.trim() : new Date().toISOString(),
        });
      }
    });

    const sitemapElements = sitemapDoc.querySelectorAll('sitemap');
    if (sitemapElements.length > 0) {
      const maxSitemaps = Math.min(sitemapElements.length, 5);
      for (let i = 0; i < maxSitemaps; i += 1) {
        const sitemapElement = sitemapElements[i];
        const loc = sitemapElement.querySelector('loc');
        sitemapElement.querySelector('lastmod');

        if (loc && loc.textContent) {
          try {
            const nestedUrls = await this.parseSitemap(loc.textContent.trim());
            urls.push(...nestedUrls);
          } catch (error) {
            // Failed to parse nested sitemap
          }
        }
      }
    }

    return urls;
  }

  filterChangedUrls(urls, previousMetadata) {
    if (!previousMetadata || !previousMetadata.pageLastModified) {
      return urls;
    }

    const changedUrls = [];
    const { pageLastModified } = previousMetadata;

    for (const url of urls) {
      const urlKey = url.loc;
      const previousLastMod = pageLastModified[urlKey];

      if (!previousLastMod || !url.lastmod || url.lastmod !== previousLastMod) {
        changedUrls.push(url);
      }
    }

    return changedUrls;
  }
}

export default SitemapSource;
