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

    if (url.includes('/sitemap') || url.endsWith('.xml')) {
      return true;
    }

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

    try {
      if (sitemapUrl && sitemapUrl.trim()) {
        targetSitemapUrl = sitemapUrl;
      } else if (this.isWebsiteUrl(source)) {
        targetSitemapUrl = await this.autoDetectSitemap(source);
      }

      return this.parseSitemap(targetSitemapUrl);
    } catch (error) {
      // Provide helpful error message with suggestions
      if (error.message.includes('Unable to find sitemap')) {
        throw error; // Re-throw our detailed error
      } else if (error.message.includes('Failed to fetch')) {
        // Check if this might be a redirect-related CORS issue
        const isRedirectIssue = targetSitemapUrl.includes('openreach.com') || 
                               targetSitemapUrl.includes('www.') || 
                               error.message.includes('redirected');
        
        if (isRedirectIssue) {
          throw new Error(
            `Failed to fetch sitemap from ${targetSitemapUrl}. This appears to be a redirect-related CORS issue. ` +
            `The server is redirecting the request, which can trigger CORS restrictions. ` +
            `Try entering the direct sitemap URL (e.g., https://www.openreach.com/sitemap.xml) in the "Direct Sitemap URL" field, ` +
            `or use a CORS proxy to bypass this restriction.`
          );
        } else {
          throw new Error(
            `Failed to fetch sitemap from ${targetSitemapUrl}. This is likely due to CORS restrictions. ` +
            `Try using a CORS proxy or enter the direct sitemap URL in the "Direct Sitemap URL" field.`
          );
        }
      } else {
        throw new Error(
          `Sitemap parsing failed: ${error.message}. ` +
          `Please try entering the direct sitemap URL or check if the website is accessible.`
        );
      }
    }
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

    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return urlPattern.test(url);
  }

  async autoDetectSitemap(websiteUrl) {
    const urlVariations = this.generateUrlVariations(websiteUrl);
    const attemptedUrls = [];
    const foundSitemaps = [];

    // Phase 1: Try to find sitemap via robots.txt and common paths
    for (const baseUrl of urlVariations) {
      try {
        this.contentOrigin = baseUrl;
        attemptedUrls.push(baseUrl);

        // Try robots.txt first
        const sitemapFromRobots = await this.findSitemapInRobots(baseUrl);
        if (sitemapFromRobots) {
          foundSitemaps.push({ url: sitemapFromRobots, source: 'robots.txt', baseUrl });
          return sitemapFromRobots;
        }

        // Try common sitemap paths
        for (const path of this.commonSitemapPaths) {
          if (path !== '/robots.txt') {
            const sitemapUrl = `${baseUrl}${path}`;
            try {
              const response = await fetch(sitemapUrl, { method: 'HEAD' });
              if (response?.ok) {
                foundSitemaps.push({ url: sitemapUrl, source: 'common-path', baseUrl });
                return sitemapUrl;
              }
            } catch (error) {
              // Continue trying other paths
            }
          }
        }
      } catch (error) {
        // Continue with next URL variation
      }
    }

    // Phase 2: Try fallback page list creation
    for (const baseUrl of urlVariations) {
      try {
        this.contentOrigin = baseUrl;
        const fallbackResult = await this.createFallbackPageList(baseUrl);
        if (fallbackResult && fallbackResult.pages && fallbackResult.pages.length > 0) {
          return fallbackResult;
        }
      } catch (error) {
        // Continue with next URL variation
      }
    }

    // Phase 3: Provide detailed error information
    const errorDetails = {
      originalUrl: websiteUrl,
      attemptedVariations: attemptedUrls,
      foundSitemaps: foundSitemaps,
      suggestions: [
        'Try entering the direct sitemap URL (e.g., https://example.com/sitemap.xml)',
        'Check if the website has a robots.txt file with sitemap information',
        'Verify the website URL is correct and accessible',
        'Some websites may block automated requests - try using a CORS proxy'
      ]
    };

    throw new Error(
      `Unable to find sitemap for ${websiteUrl}. ` +
      `Tried ${attemptedUrls.length} URL variations: ${attemptedUrls.join(', ')}. ` +
      `Found ${foundSitemaps.length} potential sitemaps but none were accessible. ` +
      `Please try entering the direct sitemap URL or check the website's robots.txt file.`
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
      `https://www.${baseDomain}`,    // Most common modern format
      `https://${baseDomain}`,        // Common modern format
      `http://www.${baseDomain}`,     // Legacy with www
      `http://${baseDomain}`,         // Legacy without www
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
        let sitemapUrl = sitemapMatches[0].replace(/^Sitemap:\s*/i, '').trim();
        
        // Fix common redirect issues by normalizing the sitemap URL
        sitemapUrl = this.normalizeSitemapUrl(sitemapUrl, baseUrl);
        
        return sitemapUrl;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Normalize sitemap URL to avoid redirect issues
   * @param {string} sitemapUrl - Sitemap URL from robots.txt
   * @param {string} baseUrl - Base URL that was used to fetch robots.txt
   * @returns {string} Normalized sitemap URL
   */
  normalizeSitemapUrl(sitemapUrl, baseUrl) {
    try {
      const sitemapUrlObj = new URL(sitemapUrl);
      const baseUrlObj = new URL(baseUrl);
      
      // If the sitemap URL domain doesn't match the base URL domain,
      // use the base URL domain to avoid redirects
      if (sitemapUrlObj.hostname !== baseUrlObj.hostname) {
        return `${baseUrlObj.protocol}//${baseUrlObj.hostname}${sitemapUrlObj.pathname}${sitemapUrlObj.search}`;
      }
      
      // If domains match but subdomains differ, use the base URL's subdomain
      if (sitemapUrlObj.hostname.replace(/^www\./, '') === baseUrlObj.hostname.replace(/^www\./, '')) {
        return `${baseUrlObj.protocol}//${baseUrlObj.hostname}${sitemapUrlObj.pathname}${sitemapUrlObj.search}`;
      }
      
      return sitemapUrl;
    } catch (error) {
      // If URL parsing fails, return original URL
      return sitemapUrl;
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
