import {
  analyzeImage,
  updateAnalysisConfig,
  getAnalysisConfig,
  clearAnalysisCache,
} from './image-analysis.js';
import { detectCategory } from './category-detector.js';
import logger from './logger.js';

// Image attributes whitelist for single-pass extraction
const REQUIRED_SOURCE_ATTRIBUTES = ['src'];

const LAZY_LOAD_ATTRIBUTES = [
  'data-src',
  'data-lazy-src',
  'data-original',
  'data-sling-src',
  'data-responsive-src',
];

const OPTIONAL_IMAGE_ATTRIBUTES = [
  'alt',
  'width',
  'height',
  'srcset',
  'sizes',
  'loading',
  'fetchpriority',
  'decoding',
  'role',
  'aria-hidden',
  'aria-label',
  'title',
];

const IMAGE_ATTRIBUTES_TO_CAPTURE = [
  ...REQUIRED_SOURCE_ATTRIBUTES,
  ...LAZY_LOAD_ATTRIBUTES,
  ...OPTIONAL_IMAGE_ATTRIBUTES,
];

class ContentParser {
  constructor(options = {}) {
    this.throttleDelay = 50;
    this.maxConcurrency = 20;
    this.corsProxy = options.corsProxy || 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/';
    this.enableImageAnalysis = options.enableImageAnalysis || false;
    this.enableCategorization = options.enableCategorization !== false;
    this.analysisConfig = options.analysisConfig || {};
    this.categorizationConfig = options.categorizationConfig || {};
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
    const startTime = Date.now();
    const results = [];
    let completed = 0;
    const errors = [];
    this.latestMediaItems = [];

    const urlsToScan = previousMetadata ? this.filterChangedUrls(urls, previousMetadata) : urls;

    for (const url of urlsToScan) {
      try {
        const mediaItems = await this.scanPage(url);
        completed += 1;

        this.latestMediaItems = mediaItems;

        if (onProgress) {
          onProgress(completed, urlsToScan.length, mediaItems.length);
        }

        results.push(...mediaItems);
      } catch (error) {
        completed += 1;
        errors.push({ url, error });
        this.latestMediaItems = [];

        if (onProgress) {
          onProgress(completed, urlsToScan.length, 0);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Scan completed: ${completed} pages, ${results.length} media items found in ${duration}s`);

    if (errors.length > 0) {
      logger.warn(`Scan had ${errors.length} error(s)`);
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

      const seenImages = new Set();

      const hasNonRenderedImages = doc.querySelector('noscript img, template img') !== null;

      const images = doc.querySelectorAll('img');

      const imageItems = await Promise.all([...images].map(async (img) => {
        if (hasNonRenderedImages && this.isInNonRenderedElement(img)) {
          return null;
        }

        const attrs = {};
        for (const attr of img.attributes) {
          if (IMAGE_ATTRIBUTES_TO_CAPTURE.includes(attr.name)) {
            attrs[attr.name] = attr.value;
          }
        }

        const rawSrc = attrs.src;
        const lazySrc = attrs['data-src']
                     || attrs['data-lazy-src']
                     || attrs['data-original']
                     || attrs['data-sling-src']
                     || attrs['data-responsive-src'];

        const actualSrc = rawSrc || lazySrc;

        if (!actualSrc || !actualSrc.trim() || !this.isMediaFile(actualSrc)) {
          return null;
        }

        const extension = this.getFileExtension(actualSrc);
        const resolvedUrl = this.resolveUrl(actualSrc, url.loc);
        const documentDomain = new URL(url.loc).hostname;
        const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
        const cleanFilename = this.getCleanFilename(actualSrc);

        const domWidth = attrs.width ? parseInt(attrs.width, 10) : undefined;
        const domHeight = attrs.height ? parseInt(attrs.height, 10) : undefined;

        // Alt text: null (missing), "" (empty), or "text" (filled)
        let altValue = null;
        if (img.hasAttribute('alt')) {
          altValue = attrs.alt || '';
        }

        const normalizedSrc = this.normalizeUrlForHash(actualSrc);

        const dedupeKey = `${normalizedSrc}|${altValue}`;
        if (seenImages.has(dedupeKey)) {
          return null;
        }
        seenImages.add(dedupeKey);

        const {
          srcset,
          sizes,
          loading,
          fetchpriority,
          role,
          title,
        } = attrs;
        const isLazyLoaded = !!lazySrc;
        const ariaHidden = attrs['aria-hidden'];
        const ariaLabel = attrs['aria-label'];

        const figureParent = img.closest('figure');
        const hasFigcaption = figureParent ? !!figureParent.querySelector('figcaption') : false;

        const classList = img.classList.length > 0 ? [...img.classList] : undefined;
        const parentTag = img.parentElement?.tagName?.toLowerCase();
        const parentHref = (parentTag === 'a' && img.parentElement.hasAttribute('href'))
          ? img.parentElement.getAttribute('href')
          : undefined;

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
        };

        if (srcset) mediaItem.srcset = srcset;
        if (sizes) mediaItem.sizes = sizes;
        if (loading) mediaItem.loading = loading;
        if (fetchpriority) mediaItem.fetchpriority = fetchpriority;
        if (isLazyLoaded) mediaItem.isLazyLoaded = isLazyLoaded;

        if (role) mediaItem.role = role;
        if (ariaHidden) mediaItem.ariaHidden = ariaHidden === 'true';
        if (ariaLabel) mediaItem.ariaLabel = ariaLabel;
        if (title) mediaItem.title = title;
        if (hasFigcaption) mediaItem.hasFigcaption = hasFigcaption;

        if (classList) mediaItem.classList = classList;
        if (parentTag && parentTag !== 'body') mediaItem.parentTag = parentTag;
        if (parentHref) mediaItem.parentHref = parentHref;

        if (this.enableCategorization) {
          try {
            const categoryResult = detectCategory(
              fixedUrl,
              mediaItem.ctx,
              mediaItem.alt,
              '',
              domWidth,
              domHeight,
            );

            mediaItem.category = categoryResult.category;
          } catch (error) {
            mediaItem.category = 'other';
          }
        }

        if (this.enableImageAnalysis) {
          try {
            const analysis = await analyzeImage(fixedUrl, null, mediaItem.ctx);

            mediaItem.orientation = analysis.orientation;
            mediaItem.width = analysis.width;
            mediaItem.height = analysis.height;
            mediaItem.exifCamera = analysis.exifCamera;
            mediaItem.exifDate = analysis.exifDate;
            mediaItem.analysisConfidence = analysis.confidence;

            if (analysis.category) {
              mediaItem.category = analysis.category;
            }

            if (analysis.exifError) {
              mediaItem.hasError = true;
              mediaItem.errorType = analysis.exifError.errorType;
              mediaItem.errorMessage = analysis.exifError.errorMessage;
              mediaItem.statusCode = analysis.exifError.statusCode;

              if (analysis.exifError.errorType === '404') {
                mediaItem.category = '404-media';
              }
            }
          } catch (error) {
            // Continue without analysis
          }
        }

        if (!this.enableImageAnalysis && domWidth !== undefined && domHeight !== undefined) {
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
    let current = element.parentElement;
    let depth = 0;
    const maxDepth = 3;

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

    const pictureElement = element.closest('picture');
    if (pictureElement) {
      context.push('picture');
    }

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

export default ContentParser;

if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}
