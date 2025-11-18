import {
  analyzeImage,
  updateAnalysisConfig,
  getAnalysisConfig,
  clearAnalysisCache,
} from './image-analysis.js';
import { filterChangedUrls } from './utils.js';

class ContentParser {
  constructor(options = {}) {
    this.throttleDelay = 50;
    this.maxConcurrency = 20;
    this.corsProxy = options.corsProxy || 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/';
    this.enableImageAnalysis = options.enableImageAnalysis || false;
    this.analysisConfig = options.analysisConfig || {};
    this.latestMediaItems = [];
    this.occurrenceCounters = new Map();

    if (this.enableImageAnalysis) {
      updateAnalysisConfig({
        enabled: true,
        ...this.analysisConfig,
      });
    }
  }

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

  getImageAnalysisConfig() {
    return {
      enabled: this.enableImageAnalysis,
      config: this.analysisConfig,
      analysisConfig: getAnalysisConfig(),
    };
  }

  async scanPages(urls, onProgress, previousMetadata = null) {
    const results = [];
    let completed = 0;
    const errors = [];
    this.latestMediaItems = []; // Reset latest items for this scan

    const urlsToScan = previousMetadata ? filterChangedUrls(urls, previousMetadata) : urls;

    for (const url of urlsToScan) {
      try {
        const mediaItems = await this.scanPage(url);
        completed += 1;

        // Store latest items for progressive display
        this.latestMediaItems = mediaItems;

        if (onProgress) {
          onProgress(completed, urlsToScan.length, mediaItems.length);
        }

        results.push(...mediaItems);
      } catch (error) {
        completed += 1;
        errors.push({ url, error });
        this.latestMediaItems = []; // Clear on error

        if (onProgress) {
          onProgress(completed, urlsToScan.length, 0);
        }
      }
    }

    return results;
  }

  getLatestMediaItems() {
    return this.latestMediaItems;
  }

  async scanPage(url) {
    try {
      const proxyUrl = `${this.corsProxy}?url=${encodeURIComponent(url.loc)}`;
      const response = await fetch(proxyUrl, { redirect: 'manual' });
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
      }

      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const mediaItems = [];
      const timestamp = new Date(url.lastmod).getTime();

      // Track seen images to skip responsive variants (same base URL, different query params)
      const seenImages = new Set();

      const images = doc.querySelectorAll('img');

      const imageItems = await Promise.all([...images].map(async (img) => {
        // Skip images inside non-rendered elements (noscript, template, etc.)
        if (this.isInNonRenderedElement(img)) {
          return null;
        }

        const rawSrc = img.getAttribute('src');
        const lazySrc = img.getAttribute('data-src')
                       || img.getAttribute('data-lazy-src')
                       || img.getAttribute('data-original')
                       || img.getAttribute('data-sling-src')
                       || img.getAttribute('data-responsive-src');

        const actualSrc = rawSrc || lazySrc;

        if (!actualSrc || !actualSrc.trim() || !this.isMediaFile(actualSrc)) {
          return null;
        }

        const extension = this.getFileExtension(actualSrc);
        const resolvedUrl = this.resolveUrl(actualSrc, url.loc);
        const documentDomain = new URL(url.loc).hostname;
        const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
        const cleanFilename = this.getCleanFilename(actualSrc);

        const domWidth = parseInt(img.getAttribute('width'), 10) || 0;
        const domHeight = parseInt(img.getAttribute('height'), 10) || 0;

        // Determine alt text value - distinguish between missing, empty, and filled
        let altValue = null;
        if (img.hasAttribute('alt')) {
          altValue = img.getAttribute('alt');
          // If getAttribute returns null but hasAttribute is true, treat as empty string
          if (altValue === null) {
            altValue = '';
          }
        }

        // Normalize URL for deduplication (removes query params for CDN images)
        const normalizedSrc = this.normalizeUrlForHash(actualSrc);

        // Skip responsive variants: same normalized URL + alt text on the same page
        const dedupeKey = `${normalizedSrc}|${altValue}`;
        if (seenImages.has(dedupeKey)) {
          return null;
        }
        seenImages.add(dedupeKey);

        const mediaItem = {
          url: fixedUrl,
          name: cleanFilename,
          alt: altValue,
          type: `img > ${extension}`,
          doc: url.loc,
          ctx: this.captureContext(img, 'img'),
          hash: this.createUniqueHash(
            actualSrc,
            url.loc,
            altValue,
            this.getOccurrenceIndex(normalizedSrc, url.loc),
          ),
          firstUsedAt: timestamp,
          lastUsedAt: timestamp,
          domWidth,
          domHeight,
        };

        if (this.enableImageAnalysis) {
          try {
            const analysis = await analyzeImage(fixedUrl, null, mediaItem.ctx);

            mediaItem.orientation = analysis.orientation;
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
            }
          } catch (error) {
            // Image analysis failed, continue without analysis
          }
        }

        // Set basic orientation from HTML attributes when deep analysis is disabled
        if (!this.enableImageAnalysis && domWidth > 0 && domHeight > 0) {
          if (domWidth === domHeight) {
            mediaItem.orientation = 'square';
          } else {
            mediaItem.orientation = domWidth > domHeight ? 'landscape' : 'portrait';
          }
          mediaItem.width = domWidth;
          mediaItem.height = domHeight;
        }

        return mediaItem;
      }));

      mediaItems.push(...imageItems.filter((item) => item !== null));

      const videos = doc.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.src && this.isMediaFile(video.src)) {
          const resolvedUrl = this.resolveUrl(video.src, url.loc);
          const documentDomain = new URL(url.loc).hostname;
          const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
          const normalizedSrc = this.normalizeUrlForHash(video.src);
          mediaItems.push({
            url: fixedUrl,
            name: this.getCleanFilename(video.src),
            alt: '',
            type: `video > ${this.getFileExtension(video.src)}`,
            doc: url.loc,
            ctx: this.captureContext(video, 'video'),
            hash: this.createUniqueHash(video.src, url.loc, '', this.getOccurrenceIndex(normalizedSrc, url.loc)),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp,
          });
        }
      });

      const sources = doc.querySelectorAll('video source');
      sources.forEach((source) => {
        if (source.src && this.isMediaFile(source.src)) {
          const resolvedUrl = this.resolveUrl(source.src, url.loc);
          const documentDomain = new URL(url.loc).hostname;
          const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
          const normalizedSrc = this.normalizeUrlForHash(source.src);
          mediaItems.push({
            url: fixedUrl,
            name: this.getCleanFilename(source.src),
            alt: '',
            type: `video-source > ${this.getFileExtension(source.src)}`,
            doc: url.loc,
            ctx: this.captureContext(source, 'video-source'),
            hash: this.createUniqueHash(source.src, url.loc, '', this.getOccurrenceIndex(normalizedSrc, url.loc)),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp,
          });
        }
      });

      const links = doc.querySelectorAll('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && this.isMediaFile(href)) {
          const resolvedUrl = this.resolveUrl(href, url.loc);
          const documentDomain = new URL(url.loc).hostname;
          const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
          const normalizedHref = this.normalizeUrlForHash(href);
          mediaItems.push({
            url: fixedUrl,
            name: this.getCleanFilename(href),
            alt: link.textContent || '',
            type: `link > ${this.getFileExtension(href)}`,
            doc: url.loc,
            ctx: this.captureContext(link, 'link'),
            hash: this.createUniqueHash(
              href,
              url.loc,
              link.textContent,
              this.getOccurrenceIndex(normalizedHref, url.loc),
            ),
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

  isInNonRenderedElement(element) {
    // Check if element is inside non-rendered elements (noscript, template, etc.)
    let current = element.parentElement;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (current && depth < maxDepth) {
      const tagName = current.tagName?.toLowerCase();
      if (tagName === 'noscript' || tagName === 'template') {
        return true;
      }
      current = current.parentElement;
      depth += 1;
    }

    return false;
  }

  captureContext(element, type) {
    const context = [type];

    // Check if element is inside a picture element
    const pictureElement = element.closest('picture');
    if (pictureElement) {
      context.push('picture');
    }

    // Check for semantic HTML elements
    const semanticParent = this.findSemanticParent(element);
    if (semanticParent) {
      context.push(`In: ${semanticParent}`);
    }

    const containerInfo = this.findContainerClasses(element);
    if (containerInfo) {
      context.push(`In: ${containerInfo}`);
    }

    const nearbyText = this.getNearbyText(element);
    if (nearbyText) {
      context.push(`text: ${nearbyText}`);
    }

    // If no meaningful context found, try to get paragraph or section context
    if (context.length === 1) {
      const paragraphContext = this.getParagraphContext(element);
      if (paragraphContext) {
        context.push(`paragraph: ${paragraphContext}`);
      }
    }

    return context.join(' > ');
  }

  findContainerClasses(element) {
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 3) {
      const classAttr = current.getAttribute('class');
      if (classAttr) {
        const classes = classAttr.split(' ').filter((c) => c.trim() && c.length > 3);
        const meaningfulClasses = classes.filter((cls) => cls.includes('section')
          || cls.includes('container')
          || cls.includes('content')
          || cls.includes('wrapper')
          || cls.includes('block')
          || cls.includes('main')
          || cls.includes('header')
          || cls.includes('footer')
          || cls.includes('nav')
          || cls.includes('article')
          || cls.includes('aside')
          || cls.includes('gallery'));

        if (meaningfulClasses.length > 0) {
          return meaningfulClasses.slice(0, 2).join(' ');
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  findSemanticParent(element) {
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 5) {
      const tagName = current.tagName?.toLowerCase();
      if (['article', 'section', 'aside', 'header', 'footer', 'nav', 'main'].includes(tagName)) {
        return tagName;
      }
      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  getParagraphContext(element) {
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 3) {
      if (current.tagName?.toLowerCase() === 'p') {
        const text = current.textContent?.trim();
        if (text && text.length > 20 && text.length < 200) {
          return text.substring(0, 50) + (text.length > 50 ? '...' : '');
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  getNearbyText(element) {
    const parent = element.parentElement;
    if (!parent) return null;

    const siblings = Array.from(parent.children || []);
    for (const sibling of siblings) {
      if (sibling !== element && sibling.textContent) {
        const text = sibling.textContent.trim();
        if (text.length > 10 && text.length < 100) {
          return text;
        }
      }
    }

    const parentText = parent.textContent?.trim();
    if (parentText && parentText.length > 10) {
      if (parentText.length <= 200) {
        return parentText;
      }
      // Return first 20 characters when text is longer than 200 chars
      return parentText.substring(0, 20);
    }

    return null;
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

  normalizeUrlForHash(url) {
    if (!url) return '';

    try {
      // Remove query parameters and fragments to normalize the URL for hashing
      const cleanUrl = url.split(/[?#]/)[0];
      return cleanUrl;
    } catch (error) {
      return url;
    }
  }

  getOccurrenceIndex(mediaUrl, pageUrl) {
    const key = `${mediaUrl}_${pageUrl}`;
    const currentCount = this.occurrenceCounters.get(key) || 0;
    this.occurrenceCounters.set(key, currentCount + 1);
    return currentCount;
  }

  createUniqueHash(mediaUrl, pageUrl, altText = '', occurrenceIndex = 0) {
    const baseString = this.normalizeUrlForHash(mediaUrl) + altText + pageUrl;
    const occurrenceString = `${baseString}_${occurrenceIndex}`;
    return this.createHash(occurrenceString);
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

export default ContentParser;

if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}
