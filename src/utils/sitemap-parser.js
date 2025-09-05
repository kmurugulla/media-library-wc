// src/utils/sitemap-parser.js
class SitemapParser {
  constructor() {
    this.throttleDelay = 200;
    this.maxConcurrency = 3;
  }

  async parseSitemap(sitemapUrl) {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      }

      const sitemapText = await response.text();
      const parser = new DOMParser();
      const sitemapDoc = parser.parseFromString(sitemapText, 'text/xml');

      // Check for parsing errors
      const parserError = sitemapDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML in sitemap');
      }

      return this.extractUrls(sitemapDoc);
    } catch (error) {
      console.error('Sitemap parsing error:', error);
      throw error;
    }
  }

  extractUrls(sitemapDoc) {
    const urls = [];
    
    // Handle regular sitemap
    const urlElements = sitemapDoc.querySelectorAll('url');
    urlElements.forEach(urlElement => {
      const loc = urlElement.querySelector('loc');
      const lastmod = urlElement.querySelector('lastmod');
      
      if (loc && loc.textContent) {
        urls.push({
          loc: loc.textContent.trim(),
          lastmod: lastmod ? lastmod.textContent.trim() : new Date().toISOString()
        });
      }
    });

    // Handle sitemap index (nested sitemaps)
    const sitemapElements = sitemapDoc.querySelectorAll('sitemap');
    if (sitemapElements.length > 0) {
      console.log(`Found sitemap index with ${sitemapElements.length} nested sitemaps`);
      // For now, we'll just log this. In a full implementation, you might want to
      // recursively parse nested sitemaps
    }

    return urls;
  }

  async scanPages(urls, onProgress) {
    const queue = new ThrottledQueue(this.maxConcurrency, this.throttleDelay);
    const results = [];
    let completed = 0;

    for (const url of urls) {
      const result = await queue.add(async () => {
        try {
          const mediaItems = await this.scanPage(url);
          completed++;
          
          if (onProgress) {
            onProgress(completed, urls.length, mediaItems.length);
          }
          
          return mediaItems;
        } catch (error) {
          console.error(`Failed to scan page ${url.loc}:`, error);
          completed++;
          
          if (onProgress) {
            onProgress(completed, urls.length, 0);
          }
          
          return [];
        }
      });
      
      results.push(...result);
    }

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
      
      const mediaItems = [];
      const timestamp = new Date(url.lastmod).getTime();

      // Parse images
      const images = doc.querySelectorAll('img');
      images.forEach(img => {
        if (img.src && this.isMediaFile(img.src)) {
          mediaItems.push({
            url: this.resolveUrl(img.src, url.loc),
            name: img.src.split('/').pop(),
            alt: img.alt || 'null',
            type: `img > ${this.getFileExtension(img.src)}`,
            doc: url.loc,
            ctx: this.captureContext(img, 'img'),
            hash: this.createHash(img.src + img.alt + url.loc),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp
          });
        }
      });

      // Parse videos
      const videos = doc.querySelectorAll('video');
      videos.forEach(video => {
        if (video.src && this.isMediaFile(video.src)) {
          mediaItems.push({
            url: this.resolveUrl(video.src, url.loc),
            name: video.src.split('/').pop(),
            alt: '',
            type: `video > ${this.getFileExtension(video.src)}`,
            doc: url.loc,
            ctx: this.captureContext(video, 'video'),
            hash: this.createHash(video.src + '' + url.loc),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp
          });
        }
      });

      // Parse video sources
      const sources = doc.querySelectorAll('video source');
      sources.forEach(source => {
        if (source.src && this.isMediaFile(source.src)) {
          mediaItems.push({
            url: this.resolveUrl(source.src, url.loc),
            name: source.src.split('/').pop(),
            alt: '',
            type: `video-source > ${this.getFileExtension(source.src)}`,
            doc: url.loc,
            ctx: this.captureContext(source, 'video-source'),
            hash: this.createHash(source.src + '' + url.loc),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp
          });
        }
      });

      // Parse links to media files
      const links = doc.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && this.isMediaFile(href)) {
          mediaItems.push({
            url: this.resolveUrl(href, url.loc),
            name: href.split('/').pop(),
            alt: link.textContent || '',
            type: `link > ${this.getFileExtension(href)}`,
            doc: url.loc,
            ctx: this.captureContext(link, 'link'),
            hash: this.createHash(href + link.textContent + url.loc),
            firstUsedAt: timestamp,
            lastUsedAt: timestamp
          });
        }
      });

      return mediaItems;
    } catch (error) {
      console.error(`Error scanning page ${url.loc}:`, error);
      return [];
    }
  }

  resolveUrl(src, docPath) {
    if (!src) return null;

    // Handle absolute URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    // Handle data URLs
    if (src.startsWith('data:')) {
      return src;
    }

    // Handle relative URLs
    if (src.startsWith('/')) {
      try {
        const docUrl = new URL(docPath);
        return `${docUrl.origin}${src}`;
      } catch {
        return src;
      }
    }

    // Handle relative paths
    try {
      const docUrl = new URL(docPath);
      const docDir = docPath.substring(0, docPath.lastIndexOf('/') + 1);
      const relativePath = docDir + src;
      return `${docUrl.origin}${relativePath}`;
    } catch {
      return src;
    }
  }

  captureContext(element, type) {
    const context = [type];

    // Capture div classes for context
    let divElement = element;
    while (divElement && divElement !== document.body) {
      if (divElement.tagName === 'DIV' && divElement.className) {
        const classes = divElement.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          context.push(`In div: ${classes.join(' ')}`);
          break;
        }
      }
      divElement = divElement.parentElement;
    }

    // Capture surrounding text
    const surroundingText = this.extractSurroundingContext(element);
    if (surroundingText) {
      context.push(`text: ${surroundingText}`);
    }

    return context.join(' > ');
  }

  extractSurroundingContext(element, maxLength = 100) {
    const context = [];

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      const text = parent.textContent?.trim();
      if (text && text.length > 10) {
        context.push(text.substring(0, maxLength));
      }
      parent = parent.parentElement;
      depth += 1;
    }

    const siblings = Array.from(element.parentElement?.children || []);
    siblings.forEach(sibling => {
      if (sibling !== element && sibling.textContent) {
        const text = sibling.textContent.trim();
        if (text && text.length > 5) {
          context.push(text.substring(0, maxLength));
        }
      }
    });

    return context.slice(0, 3).join(' ').substring(0, maxLength);
  }

  isMediaFile(url) {
    const mediaExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', // Images
      'mp4', 'webm', 'mov', 'avi', // Videos
      'pdf', // Documents
      'mp3', 'wav' // Audio
    ];
    
    const extension = this.getFileExtension(url);
    return mediaExtensions.includes(extension.toLowerCase());
  }

  getFileExtension(url) {
    return url?.split('.').pop()?.toLowerCase() || '';
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
}

class ThrottledQueue {
  constructor(concurrency = 3, delay = 100) {
    this.queue = [];
    this.running = 0;
    this.concurrency = concurrency;
    this.delay = delay;
    this.isPaused = false;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0 || this.isPaused) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.running++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      // Add delay before processing next batch
      setTimeout(() => this.process(), this.delay);
    }
  }
}

export { SitemapParser };
