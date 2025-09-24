/**
 * Sitemap Data Source
 * Provides page lists from XML sitemaps for the Media Library component
 */

class SitemapSource {
  constructor(options = {}) {
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
    this.corsProxy = options.corsProxy || 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/';
    this.useCorsProxy = options.useCorsProxy !== false;
  }

  /**
   * Fetch URL with CORS proxy support
   * @param {string} url - URL to fetch
   * @param {object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async fetchWithProxy(url, options = {}) {
    if (!this.useCorsProxy) {
      return fetch(url, options);
    }

    try {
      const response = await fetch(url, options);
      
      // Check for Cloudflare protection
      if (response.status === 403) {
        const text = await response.text();
        if (text.includes('Cloudflare') || text.includes('Attention Required')) {
          throw new Error(
            `Website is protected by Cloudflare security measures. `
            + 'Please use the direct sitemap URL instead of the website URL. '
            + 'Try entering the full sitemap URL (e.g., https://www.durysta.com/sitemap.xml) in the "Direct Sitemap URL" field.',
          );
        }
      }
      
      return response;
    } catch (error) {
      const isCorsError = error.message.includes('CORS')
                         || error.message.includes('Failed to fetch')
                         || error.message.includes('blocked by CORS policy')
                         || error.name === 'TypeError';

      if (isCorsError) {
        try {
          const proxyUrl = `${this.corsProxy}?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl, options);
          if (response.ok) {
            return response;
          }
          
          // Check if proxy also gets Cloudflare protection
          const text = await response.text();
          if (text.includes('Cloudflare') || text.includes('Attention Required')) {
            throw new Error(
              `Website is protected by Cloudflare security measures. `
              + 'Please use the direct sitemap URL instead of the website URL. '
              + 'Try entering the full sitemap URL (e.g., https://www.durysta.com/sitemap.xml) in the "Direct Sitemap URL" field.',
            );
          }
        } catch (proxyError) {
          // eslint-disable-next-line no-console
          console.warn('CORS proxy failed:', proxyError.message);
        }

        throw new Error(
          `Failed to fetch ${url} due to CORS restrictions. `
          + 'The website appears to be protected by Cloudflare or similar security measures that block automated access. '
          + 'This is a common issue with websites that have strict security policies. '
          + 'Unfortunately, there is no way to bypass this protection from a web browser. '
          + 'You may need to contact the website owner or use a different approach to access the sitemap data.',
        );
      }

      throw error;
    }
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
    // Allow empty source if sitemapUrl is provided
    if (!source && !sitemapUrl) {
      throw new Error('Either source URL or sitemap URL must be provided');
    }

    if (source && !this.canHandle(source)) {
      throw new Error('Invalid source URL for sitemap discovery');
    }

    try {
      if (sitemapUrl && sitemapUrl.trim()) {
        return this.parseSitemap(sitemapUrl);
      }
      if (source && this.isWebsiteUrl(source)) {
        return this.getPageListFromAllSitemaps(source);
      }
      if (source) {
        return this.parseSitemap(source);
      }
      throw new Error('No valid source or sitemap URL provided');
    } catch (error) {
      if (error.message.includes('Unable to find sitemap')) {
        throw error;
      }
      if (error.message.includes('Failed to fetch')) {
        const isRedirectIssue = source.includes('www.')
                               || error.message.includes('redirected');

        if (isRedirectIssue) {
          throw new Error(
            `Failed to fetch sitemap from ${source}. This appears to be a redirect-related CORS issue. `
            + 'The server is redirecting the request, which can trigger CORS restrictions. '
            + 'Try entering the direct sitemap URL in the "Direct Sitemap URL" field, '
            + 'or use a CORS proxy to bypass this restriction.',
          );
        }
        throw new Error(
          `Failed to fetch sitemap from ${source}. This is likely due to CORS restrictions. `
          + 'The sitemap source is configured to use a CORS proxy automatically, but it may have failed. '
          + 'Try entering the direct sitemap URL in the "Direct Sitemap URL" field or check your CORS proxy configuration.',
        );
      }
      throw new Error(
        `Sitemap parsing failed: ${error.message}. `
        + 'Please try entering the direct sitemap URL or check if the website is accessible.',
      );
    }
  }

  /**
   * Get page list from all sitemaps found for a website
   * @param {string} websiteUrl - Website URL
   * @returns {Promise<Array>} Array of page objects from all sitemaps
   */
  async getPageListFromAllSitemaps(websiteUrl) {
    const urlVariations = this.generateUrlVariations(websiteUrl);
    const allPages = [];
    const attemptedUrls = [];

    for (const baseUrl of urlVariations) {
      try {
        this.contentOrigin = baseUrl;

        const sitemapsFromRobots = await this.findSitemapInRobots(baseUrl);
        if (sitemapsFromRobots && sitemapsFromRobots.length > 0) {
          for (const sitemapUrl of sitemapsFromRobots) {
            attemptedUrls.push(sitemapUrl);
            try {
              const pages = await this.parseSitemap(sitemapUrl);
              allPages.push(...pages);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.warn(`Failed to parse sitemap ${sitemapUrl}:`, error.message);
            }
          }

          if (allPages.length > 0) {
            return allPages;
          }
        }

        for (const path of this.commonSitemapPaths) {
          if (path !== '/robots.txt') {
            const sitemapUrl = `${baseUrl}${path}`;
            attemptedUrls.push(sitemapUrl);
            try {
              const response = await this.fetchWithProxy(sitemapUrl, { method: 'HEAD' });
              if (response?.ok) {
                const pages = await this.parseSitemap(sitemapUrl);
                allPages.push(...pages);
                return allPages;
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

    // eslint-disable-next-line no-console
    console.log('Attempted URLs:', attemptedUrls);

    throw new Error(
      `Unable to find sitemap for ${websiteUrl}. `
      + 'Tried common sitemap locations and robots.txt discovery. '
      + 'Please try entering the direct sitemap URL or check if the website is accessible.',
    );
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

    // Normalize the URL first
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }

    domain = domain.replace(/^https?:\/\//, '');

    const baseDomain = domain.replace(/^www\./, '');
    const variations = [
      `https://www.${baseDomain}`,
      `https://${baseDomain}`,
      `http://www.${baseDomain}`,
      `http://${baseDomain}`,
    ];

    return [...new Set(variations)];
  }

  async findSitemapInRobots(baseUrl) {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;

      const response = await this.fetchWithProxy(robotsUrl);
      if (!response.ok) {
        return null;
      }

      const robotsText = await response.text();
      const sitemapMatches = robotsText.match(/^Sitemap:\s*(.+)$/gim);

      if (sitemapMatches && sitemapMatches.length > 0) {
        const sitemapUrls = sitemapMatches.map((match) => {
          const sitemapUrl = match.replace(/^Sitemap:\s*/i, '').trim();
          return this.normalizeSitemapUrl(sitemapUrl, baseUrl);
        });

        return sitemapUrls;
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

      if (sitemapUrlObj.hostname !== baseUrlObj.hostname) {
        return `${baseUrlObj.protocol}//${baseUrlObj.hostname}${sitemapUrlObj.pathname}${sitemapUrlObj.search}`;
      }

      if (sitemapUrlObj.hostname.replace(/^www\./, '') === baseUrlObj.hostname.replace(/^www\./, '')) {
        return `${baseUrlObj.protocol}//${baseUrlObj.hostname}${sitemapUrlObj.pathname}${sitemapUrlObj.search}`;
      }

      return sitemapUrl;
    } catch (error) {
      return sitemapUrl;
    }
  }

  async parseSitemap(sitemapUrl) {
    const response = await this.fetchWithProxy(sitemapUrl);
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
      for (let i = 0; i < sitemapElements.length; i += 1) {
        const sitemapElement = sitemapElements[i];
        const loc = sitemapElement.querySelector('loc');

        if (loc && loc.textContent) {
          try {
            const nestedUrls = await this.parseSitemap(loc.textContent.trim());
            urls.push(...nestedUrls);
          } catch (error) {
            // Continue with next sitemap
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
