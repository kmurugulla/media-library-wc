// src/utils/sitemap-parser.js
import {
  analyzeImage,
  updateAnalysisConfig,
  getAnalysisConfig,
  clearAnalysisCache,
} from './image-analysis.js';
import Queue from './queue.js';

class SitemapParser {
  constructor(options = {}) {
    this.throttleDelay = 50;
    this.maxConcurrency = 20;
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
    this.enableImageAnalysis = options.enableImageAnalysis || false;
    this.analysisConfig = options.analysisConfig || {};

    if (this.enableImageAnalysis) {
      updateAnalysisConfig({
        enabled: true,
        ...this.analysisConfig,
      });
    }
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
            const response = await fetch(sitemapUrl, { method: 'HEAD' }).catch(() => null);
            if (response?.ok) {
              return sitemapUrl;
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

  /**
   * Enable or disable image analysis
   * @param {boolean} enabled - Whether to enable image analysis
   * @param {Object} config - Analysis configuration options
   */
  setImageAnalysis(enabled, config = {}) {
    this.enableImageAnalysis = enabled;
    this.analysisConfig = config;

    if (enabled) {
      updateAnalysisConfig({
        enabled: true,
        ...config,
      });
    } else {
      updateAnalysisConfig({ enabled: false });
    }
  }

  /**
   * Get current image analysis configuration
   * @returns {Object} Current configuration
   */
  getImageAnalysisConfig() {
    return {
      enabled: this.enableImageAnalysis,
      config: this.analysisConfig,
      analysisConfig: getAnalysisConfig(),
    };
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
        `Cannot access ${baseUrl}. This might be due to CORS restrictions or the site blocking requests.`,
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

  async scanPages(urls, onProgress, previousMetadata = null) {
    const results = [];
    let completed = 0;
    const errors = [];
    let skipped = 0;

    const urlsToScan = previousMetadata ? this.filterChangedUrls(urls, previousMetadata) : urls;
    skipped = urls.length - urlsToScan.length;

    if (skipped > 0) {
      // URLs were skipped due to no changes
    }
    const callback = async (url) => {
      try {
        const mediaItems = await this.scanPage(url);
        completed += 1;

        if (onProgress) {
          onProgress(completed, urlsToScan.length, mediaItems.length);
        }

        results.push(...mediaItems);
      } catch (error) {
        completed += 1;

        if (onProgress) {
          onProgress(completed, urlsToScan.length, 0);
        }
      }
    };

    const onError = (item, error) => {
      errors.push({ item, error });
    };

    const queue = new Queue(callback, this.maxConcurrency, onError);
    const promises = urlsToScan.map((url) => queue.push(url));
    await Promise.allSettled(promises);

    return results;
  }

  async scanPage(url) {
    try {
      const response = await fetch(url.loc);
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
      }

      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const baseTag = doc.querySelector('base');
      if (baseTag) {
        // Base tag found but not used in current implementation
      }

      const title = doc.querySelector('title');
      if (title) {
        // Title found but not used in current implementation
      }

      const metaTags = doc.querySelectorAll(
        'meta[name*="env"], meta[name*="environment"], meta[property*="env"]',
      );
      if (metaTags.length > 0) {
        // Environment meta tags found but not used in current implementation
      }

      const mediaItems = [];
      const timestamp = new Date(url.lastmod).getTime();

      const images = doc.querySelectorAll('img');

      if (images.length > 0) {
        // Images found, processing below
      }

      for (let index = 0; index < images.length; index += 1) {
        const img = images[index];

        const rawSrc = img.getAttribute('src');
        const lazySrc = img.getAttribute('data-src')
                       || img.getAttribute('data-lazy-src')
                       || img.getAttribute('data-original')
                       || img.getAttribute('data-sling-src')
                       || img.getAttribute('data-responsive-src');

        const actualSrc = rawSrc || lazySrc;

        if (actualSrc && actualSrc.trim() !== '') {
          const isMedia = this.isMediaFile(actualSrc);
          const extension = this.getFileExtension(actualSrc);

          if (isMedia) {
            const resolvedUrl = this.resolveUrl(actualSrc, url.loc);

            const documentDomain = new URL(url.loc).hostname;
            const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);

            const cleanFilename = this.getCleanFilename(actualSrc);

            const mediaItem = {
              url: fixedUrl,
              name: cleanFilename,
              alt: img.alt || 'null',
              type: `img > ${extension}`,
              doc: url.loc,
              ctx: this.captureContext(img, 'img'),
              hash: this.createHash(actualSrc + img.alt + url.loc),
              firstUsedAt: timestamp,
              lastUsedAt: timestamp,
            };

            if (this.enableImageAnalysis) {
              try {
                const analysis = await analyzeImage(fixedUrl, null, mediaItem.ctx);

                mediaItem.orientation = analysis.orientation;
                mediaItem.category = analysis.category;
                mediaItem.categoryConfidence = analysis.categoryConfidence;
                mediaItem.categoryScore = analysis.categoryScore;
                mediaItem.categorySource = analysis.categorySource;
                mediaItem.width = analysis.width;
                mediaItem.height = analysis.height;
                mediaItem.exifCamera = analysis.exifCamera;
                mediaItem.exifDate = analysis.exifDate;
                mediaItem.analysisConfidence = analysis.confidence;

                if (analysis.exifError) {
                  mediaItem.hasError = true;
                  mediaItem.errorType = analysis.exifError.errorType;
                  mediaItem.errorMessage = analysis.exifError.errorMessage;
                  mediaItem.statusCode = analysis.exifError.statusCode;

                  if (analysis.exifError.errorType === '404') {
                    mediaItem.category = '404s';
                  }
                }
              } catch (error) {
                // Image analysis failed
              }
            }

            mediaItems.push(mediaItem);
          }
        }
      }

      const videos = doc.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.src && this.isMediaFile(video.src)) {
          mediaItems.push({
            url: this.resolveUrl(video.src, url.loc),
            name: this.getCleanFilename(video.src),
            alt: '',
            type: `video > ${this.getFileExtension(video.src)}`,
            doc: url.loc,
            ctx: this.captureContext(video, 'video'),
            hash: this.createHash(`${video.src}${url.loc}`),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp,
          });
        }
      });

      const sources = doc.querySelectorAll('video source');
      sources.forEach((source) => {
        if (source.src && this.isMediaFile(source.src)) {
          mediaItems.push({
            url: this.resolveUrl(source.src, url.loc),
            name: this.getCleanFilename(source.src),
            alt: '',
            type: `video-source > ${this.getFileExtension(source.src)}`,
            doc: url.loc,
            ctx: this.captureContext(source, 'video-source'),
            hash: this.createHash(`${source.src}${url.loc}`),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp,
          });
        }
      });

      const links = doc.querySelectorAll('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && this.isMediaFile(href)) {
          mediaItems.push({
            url: this.resolveUrl(href, url.loc),
            name: this.getCleanFilename(href),
            alt: link.textContent || '',
            type: `link > ${this.getFileExtension(href)}`,
            doc: url.loc,
            ctx: this.captureContext(link, 'link'),
            hash: this.createHash(href + link.textContent + url.loc),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp,
          });
        }
      });

      return mediaItems;
    } catch (error) {
      return [];
    }
  }

  resolveUrl(src, docPath) {
    if (!src) {
      return null;
    }

    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    if (src.startsWith('data:')) {
      return src;
    }
    try {
      const docUrl = new URL(docPath);
      const resolvedUrl = new URL(src, docUrl);
      const result = resolvedUrl.toString();
      return result;
    } catch (error) {
      return src;
    }
  }

  captureContext(element, type) {
    const context = [type];

    const containerInfo = this.findMeaningfulContainer(element);
    if (containerInfo) {
      context.push(`In div: ${containerInfo}`);
      return context.join(' > ');
    }

    const surroundingText = this.extractSurroundingContext(element);
    if (surroundingText) {
      context.push(`text: ${surroundingText}`);
    }

    return context.join(' > ');
  }

  findMeaningfulContainer(element) {
    let currentElement = element;

    while (currentElement && currentElement !== document.body) {
      if (currentElement.tagName === 'DIV' || currentElement.tagName === 'MAIN' || currentElement.tagName === 'SECTION' || currentElement.tagName === 'ARTICLE') {
        const classAttr = currentElement.getAttribute('class') || '';

        if (classAttr) {
          const classes = classAttr.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const meaningfulClasses = classes.filter((cls) => {
              const lowerCls = cls.toLowerCase();
              if (['style', 'content', 'div', 'span', 'p', 'a', 'img'].includes(lowerCls)) {
                return false;
              }
              return cls.length > 3
                || cls.includes('section')
                || cls.includes('container')
                || cls.includes('metadata')
                || cls.includes('wrapper')
                || cls.includes('block')
                || cls.includes('main')
                || cls.includes('header')
                || cls.includes('footer')
                || cls.includes('nav')
                || cls.includes('article')
                || cls.includes('aside');
            });

            if (meaningfulClasses.length > 0) {
              return meaningfulClasses.join(' ');
            }
          }
        }
      }
      currentElement = currentElement.parentElement;
    }

    return this.findNearbyContainer(element);
  }

  findNearbyContainer(element) {
    let currentElement = element;
    while (currentElement && currentElement !== document.body) {
      if (currentElement.tagName === 'DIV' || currentElement.tagName === 'MAIN' || currentElement.tagName === 'SECTION' || currentElement.tagName === 'ARTICLE') {
        const classAttr = currentElement.getAttribute('class') || '';
        if (classAttr) {
          const classes = classAttr.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const meaningfulClasses = classes.filter((cls) => cls.includes('section')
              || cls.includes('container')
              || cls.includes('metadata')
              || cls.includes('content')
              || cls.includes('wrapper')
              || cls.includes('block')
              || cls.includes('main')
              || cls.length > 4);
            if (meaningfulClasses.length > 0) {
              return meaningfulClasses.join(' ');
            }
          }
        }
      }
      currentElement = currentElement.parentElement;
    }

    const parent = element.parentElement;
    if (!parent) return null;

    const siblings = Array.from(parent.children || []);
    for (const sibling of siblings) {
      if (sibling.tagName === 'DIV' || sibling.tagName === 'MAIN' || sibling.tagName === 'SECTION' || sibling.tagName === 'ARTICLE') {
        const classAttr = sibling.getAttribute('class') || '';
        if (classAttr) {
          const classes = classAttr.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const meaningfulClasses = classes.filter((cls) => cls.includes('section')
              || cls.includes('container')
              || cls.includes('metadata')
              || cls.includes('content')
              || cls.includes('wrapper')
              || cls.includes('block')
              || cls.includes('main')
              || cls.length > 4);
            if (meaningfulClasses.length > 0) {
              return meaningfulClasses.join(' ');
            }
          }
        }
      }
    }

    const parentSiblings = Array.from(parent.parentElement?.children || []);
    for (const sibling of parentSiblings) {
      if (sibling.tagName === 'DIV' || sibling.tagName === 'MAIN' || sibling.tagName === 'SECTION' || sibling.tagName === 'ARTICLE') {
        const classAttr = sibling.getAttribute('class') || '';
        if (classAttr) {
          const classes = classAttr.split(' ').filter((c) => c.trim());
          if (classes.length > 0) {
            const meaningfulClasses = classes.filter((cls) => cls.includes('section')
              || cls.includes('container')
              || cls.includes('metadata')
              || cls.includes('content')
              || cls.includes('wrapper')
              || cls.includes('block')
              || cls.includes('main')
              || cls.length > 4);
            if (meaningfulClasses.length > 0) {
              return meaningfulClasses.join(' ');
            }
          }
        }
      }
    }

    return null;
  }

  extractSurroundingContext(element, maxLength = 100) {
    const context = [];
    const meaninglessWords = ['style', 'content', 'div', 'span', 'p', 'a', 'img', 'button', 'input'];

    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children || []);
      for (const sibling of siblings) {
        if (sibling !== element && sibling.textContent) {
          const text = sibling.textContent.trim();
          if (this.isMeaningfulText(text, meaninglessWords)) {
            context.push(text.substring(0, maxLength));
          }
        }
      }

      const parentSiblings = Array.from(parent.parentElement?.children || []);
      for (const sibling of parentSiblings) {
        if (sibling.textContent) {
          const text = sibling.textContent.trim();
          if (this.isMeaningfulText(text, meaninglessWords)) {
            context.push(text.substring(0, maxLength));
          }
        }
      }
    }

    if (context.length === 0) {
      let currentParent = element.parentElement;
      let depth = 0;
      while (currentParent && depth < 3) {
        const text = currentParent.textContent?.trim();
        if (this.isMeaningfulText(text, meaninglessWords)) {
          context.push(text.substring(0, maxLength));
        }
        currentParent = currentParent.parentElement;
        depth += 1;
      }
    }

    return context.slice(0, 3).join(' ').substring(0, maxLength);
  }

  isMeaningfulText(text, meaninglessWords) {
    if (!text || text.length < 5) return false;

    const words = text.toLowerCase().split(/\s+/);
    const meaningfulWords = words.filter((word) => word.length > 2
      && !meaninglessWords.includes(word));

    return meaningfulWords.length > 0 || text.length > 20;
  }

  isMediaFile(url) {
    if (!url || typeof url !== 'string') return false;

    const mediaExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff', 'ico',
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v',
      'pdf', 'doc', 'docx', 'txt', 'rtf',
      'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a',
    ];

    const extension = this.getFileExtension(url);
    return extension && mediaExtensions.includes(extension.toLowerCase());
  }

  getFileExtension(url) {
    if (!url) return '';

    try {
      const cleanUrl = url.split(/[?#]/)[0];

      const extension = cleanUrl.split('.').pop()?.toLowerCase() || '';

      if (!extension || extension === cleanUrl || /[^a-z0-9]/.test(extension)) {
        return '';
      }

      return extension;
    } catch (error) {
      return '';
    }
  }

  getCleanFilename(url) {
    if (!url) return '';

    try {
      const cleanUrl = url.split(/[?#]/)[0];

      const filename = cleanUrl.split('/').pop() || '';

      return filename;
    } catch (error) {
      return '';
    }
  }

  fixLocalhostUrl(url, originalDomain) {
    if (!url || !originalDomain) return url;

    if (url.includes('localhost:')) {
      try {
        const localhostUrl = new URL(url);
        const pathAndQuery = localhostUrl.pathname + localhostUrl.search;

        const fixedUrl = `https://${originalDomain}${pathAndQuery}`;

        return fixedUrl;
      } catch (error) {
        return url;
      }
    }

    return url;
  }

  createHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(36).padStart(10, '0');

    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      hash = ((hash * 33) + char) % 2147483647;
    }

    const base36 = Math.abs(hash).toString(36);
    return base36.padStart(10, '0');
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

  testHtmlParsing(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const images = doc.querySelectorAll('img');

    images.forEach((img) => {
      this.captureContext(img, 'img');
    });

    return images.length;
  }
}

export default SitemapParser;

if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}
