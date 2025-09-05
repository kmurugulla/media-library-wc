// src/utils/sitemap-parser.js
class SitemapParser {
  constructor() {
    this.throttleDelay = 50; // Reduced from 200ms to 50ms for faster processing
    this.maxConcurrency = 20; // Increased from 3 to 20 for better parallelism
    this.commonSitemapPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap-index.xml',
      '/sitemaps.xml',
      '/sitemap/sitemap.xml',
      '/sitemap/index.xml',
      '/robots.txt' // We'll check robots.txt for sitemap references
    ];
    this.contentOrigin = null; // Will be set based on the website being scanned
  }

  async autoDetectSitemap(websiteUrl) {
    try {
      // Generate URL variations to try
      const urlVariations = this.generateUrlVariations(websiteUrl);
      console.log(`Auto-detecting sitemap for: ${websiteUrl}`);
      console.log(`Trying URL variations:`, urlVariations);

      // Try each URL variation
      for (const baseUrl of urlVariations) {
        try {
          console.log(`\n--- Trying URL variation: ${baseUrl} ---`);
          this.contentOrigin = baseUrl; // Set content origin for proper URL resolution

          // First, try to find sitemap in robots.txt
          const sitemapFromRobots = await this.findSitemapInRobots(baseUrl);
          if (sitemapFromRobots) {
            console.log(`✅ Found sitemap in robots.txt: ${sitemapFromRobots}`);
            return sitemapFromRobots;
          }

          // If not found in robots.txt, try common sitemap paths
          for (const path of this.commonSitemapPaths) {
            if (path === '/robots.txt') continue; // Skip robots.txt as we already checked it
            
            const sitemapUrl = `${baseUrl}${path}`;
            try {
              console.log(`Trying sitemap path: ${sitemapUrl}`);
              const response = await fetch(sitemapUrl, { method: 'HEAD' });
              if (response.ok) {
                console.log(`✅ Found sitemap at: ${sitemapUrl}`);
                return sitemapUrl;
              }
            } catch (error) {
              // Continue to next path
              console.log(`Failed to fetch ${sitemapUrl}:`, error.message);
            }
          }

          console.log(`❌ No sitemap found for ${baseUrl}`);
        } catch (error) {
          console.log(`❌ Error trying ${baseUrl}:`, error.message);
          // Continue to next URL variation
        }
      }

      // If no sitemap found in any variation, try to create a simple page list for the first working URL
      console.log(`\nNo sitemap found in any URL variation, attempting to scan main pages...`);
      for (const baseUrl of urlVariations) {
        try {
          console.log(`Trying fallback page list for: ${baseUrl}`);
          this.contentOrigin = baseUrl;
          return await this.createFallbackPageList(baseUrl);
        } catch (error) {
          console.log(`Failed fallback for ${baseUrl}:`, error.message);
          // Continue to next URL variation
        }
      }

      throw new Error(`No sitemap found and unable to create fallback page list for any URL variation of: ${websiteUrl}`);
    } catch (error) {
      console.error('Sitemap auto-detection error:', error);
      throw error;
    }
  }

  normalizeWebsiteUrl(url) {
    // Remove trailing slash and ensure it starts with http/https
    let normalizedUrl = url.trim();
    
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/$/, '');
    
    return normalizedUrl;
  }

  generateUrlVariations(url) {
    // Extract domain from the URL
    let domain = url.trim();
    
    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, '');
    
    // Remove www. if present to get base domain
    const baseDomain = domain.replace(/^www\./, '');
    
    // Generate variations
    const variations = [
      `https://${baseDomain}`,
      `https://www.${baseDomain}`,
      `http://${baseDomain}`,
      `http://www.${baseDomain}`
    ];
    
    // Remove duplicates and return
    return [...new Set(variations)];
  }

  async findSitemapInRobots(baseUrl) {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      console.log(`Checking robots.txt: ${robotsUrl}`);
      
      const response = await fetch(robotsUrl);
      if (!response.ok) {
        return null;
      }

      const robotsText = await response.text();
      const sitemapMatches = robotsText.match(/^Sitemap:\s*(.+)$/gim);
      
      if (sitemapMatches && sitemapMatches.length > 0) {
        // Return the first sitemap found
        const sitemapUrl = sitemapMatches[0].replace(/^Sitemap:\s*/i, '').trim();
        return sitemapUrl;
      }
      
      return null;
    } catch (error) {
      console.log(`Failed to check robots.txt: ${error.message}`);
      return null;
    }
  }

  async createFallbackPageList(baseUrl) {
    // For sites without sitemaps, create a simple list of common pages
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
      '/search'
    ];

    // Add Medium-specific paths if it's Medium
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
        '/topic/web-development'
      ];
    }

    // Try to fetch the homepage to see if it's accessible
    try {
      const response = await fetch(baseUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Cannot access ${baseUrl}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Cannot access ${baseUrl}. This might be due to CORS restrictions or the site blocking requests.`);
    }

    // Return a mock sitemap object that will be handled by parseSitemap
    return {
      type: 'fallback',
      baseUrl,
      pages: commonPages.map(page => ({
        loc: `${baseUrl}${page}`,
        lastmod: new Date().toISOString()
      }))
    };
  }

  async parseSitemap(sitemapUrl) {
    try {
      // Handle fallback page list
      if (sitemapUrl && typeof sitemapUrl === 'object' && sitemapUrl.type === 'fallback') {
        console.log(`Using fallback page list for: ${sitemapUrl.baseUrl}`);
        return sitemapUrl.pages;
      }

      console.log(`Attempting to fetch sitemap from: ${sitemapUrl}`);
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

      return await this.extractUrls(sitemapDoc);
    } catch (error) {
      console.error('Sitemap parsing error:', error);
      throw error;
    }
  }

  async extractUrls(sitemapDoc) {
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
      
      // Process first few sitemaps to avoid overwhelming the system
      const maxSitemaps = Math.min(sitemapElements.length, 5);
      for (let i = 0; i < maxSitemaps; i++) {
        const sitemapElement = sitemapElements[i];
        const loc = sitemapElement.querySelector('loc');
        const lastmod = sitemapElement.querySelector('lastmod');
        
        if (loc && loc.textContent) {
          try {
            console.log(`Processing nested sitemap: ${loc.textContent.trim()}`);
            const nestedUrls = await this.parseSitemap(loc.textContent.trim());
            urls.push(...nestedUrls);
          } catch (error) {
            console.warn(`Failed to parse nested sitemap ${loc.textContent.trim()}:`, error);
            // This is often due to CORS restrictions when trying to access nested sitemaps
            // Continue with other sitemaps even if one fails
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

    // If we have previous metadata, filter URLs that haven't changed
    const urlsToScan = previousMetadata ? this.filterChangedUrls(urls, previousMetadata) : urls;
    skipped = urls.length - urlsToScan.length;

    if (skipped > 0) {
      console.log(`Incremental scan: skipping ${skipped} unchanged pages`);
    }

    // Create callback function for the queue
    const callback = async (url) => {
      try {
        const mediaItems = await this.scanPage(url);
        completed++;
        
        if (onProgress) {
          onProgress(completed, urlsToScan.length, mediaItems.length);
        }
        
        results.push(...mediaItems);
      } catch (error) {
        console.error(`Failed to scan page ${url.loc}:`, error);
        completed++;
        
        if (onProgress) {
          onProgress(completed, urlsToScan.length, 0);
        }
      }
    };

    // Error handler for the queue
    const onError = (item, error) => {
      errors.push({ item, error });
      console.error(`Queue error for ${item.loc}:`, error);
    };

    // Create queue with high concurrency
    const queue = new Queue(callback, this.maxConcurrency, onError);

    // Process all URLs concurrently
    const promises = urlsToScan.map(url => queue.push(url));
    await Promise.allSettled(promises);

    console.log(`Scan completed: ${completed}/${urlsToScan.length} pages scanned, ${skipped} skipped, ${results.length} media items found, ${errors.length} errors`);
    return results;
  }

  async scanPage(url) {
    try {
      console.log(`Scanning page: ${url.loc}`);
      console.log(`  → DEBUG: Page URL being scanned: "${url.loc}"`);
      const response = await fetch(url.loc);
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
      }

      const html = await response.text();
      console.log(`Page ${url.loc}: HTML length = ${html.length} characters`);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // DEBUG: Check for base tag or other URL rewriting
      const baseTag = doc.querySelector('base');
      if (baseTag) {
        console.log(`  → DEBUG: Found base tag with href: "${baseTag.href}"`);
      } else {
        console.log(`  → DEBUG: No base tag found`);
      }
      
      // DEBUG: Check if this is a development/staging environment
      const title = doc.querySelector('title');
      if (title) {
        console.log(`  → DEBUG: Page title: "${title.textContent}"`);
      }
      
      // DEBUG: Look for any meta tags that might indicate environment
      const metaTags = doc.querySelectorAll('meta[name*="env"], meta[name*="environment"], meta[property*="env"]');
      if (metaTags.length > 0) {
        console.log(`  → DEBUG: Found environment-related meta tags:`);
        metaTags.forEach((meta, index) => {
          console.log(`    ${index + 1}. ${meta.name || meta.property}: "${meta.content}"`);
        });
      }
      
      const mediaItems = [];
      const timestamp = new Date(url.lastmod).getTime();

      // Parse images
      const images = doc.querySelectorAll('img');
      console.log(`Page ${url.loc}: Found ${images.length} img tags`);
      
      // DEBUG: Log first few img src attributes to see what we're getting
      if (images.length > 0) {
        console.log(`  → DEBUG: First few img src attributes:`);
        for (let i = 0; i < Math.min(3, images.length); i++) {
          const rawSrc = images[i].getAttribute('src');
          const lazySrc = images[i].getAttribute('data-src') || 
                         images[i].getAttribute('data-sling-src') ||
                         images[i].getAttribute('data-lazy-src');
          console.log(`    ${i + 1}. src="${rawSrc}", lazy="${lazySrc}"`);
        }
      }
      
      images.forEach((img, index) => {
        // Get the raw src attribute value, not the resolved URL
        const rawSrc = img.getAttribute('src');
        
        // Also check for common lazy loading data attributes
        const lazySrc = img.getAttribute('data-src') || 
                       img.getAttribute('data-lazy-src') || 
                       img.getAttribute('data-original') || 
                       img.getAttribute('data-sling-src') ||
                       img.getAttribute('data-responsive-src');
        
        const actualSrc = rawSrc || lazySrc;
        console.log(`  Image ${index + 1}: src="${rawSrc}", lazy="${lazySrc}", alt="${img.alt}"`);
        
        if (actualSrc && actualSrc.trim() !== '') {
          const isMedia = this.isMediaFile(actualSrc);
          const extension = this.getFileExtension(actualSrc);
          console.log(`    → Extension: ${extension}, IsMedia: ${isMedia}`);
          
          if (isMedia) {
            // DEBUG: Track URL transformation
            console.log(`    → DEBUG: Original actualSrc: "${actualSrc}"`);
            console.log(`    → DEBUG: Document URL (url.loc): "${url.loc}"`);
            
            const resolvedUrl = this.resolveUrl(actualSrc, url.loc);
            console.log(`    → DEBUG: Resolved URL: "${resolvedUrl}"`);
            
            // Extract domain from document URL for localhost fixing
            const documentDomain = new URL(url.loc).hostname;
            const fixedUrl = this.fixLocalhostUrl(resolvedUrl, documentDomain);
            console.log(`    → DEBUG: Final URL after localhost fix: "${fixedUrl}"`);
            
            const cleanFilename = this.getCleanFilename(actualSrc);
            console.log(`    → DEBUG: Clean filename: "${cleanFilename}"`);
            
            const mediaItem = {
              url: fixedUrl,
              name: cleanFilename,
              alt: img.alt || 'null',
              type: `img > ${extension}`,
              doc: url.loc,
              ctx: this.captureContext(img, 'img'),
              hash: this.createHash(actualSrc + img.alt + url.loc),
              firstUsedAt: timestamp,
              lastUsedAt: timestamp
            };
            console.log(`  → Added media item:`, mediaItem);
            mediaItems.push(mediaItem);
          } else {
            console.log(`  → Skipped (not a media file): ${actualSrc}`);
          }
        } else {
          console.log(`  → Skipped (no src attribute)`);
        }
      });

      // Parse videos
      const videos = doc.querySelectorAll('video');
      videos.forEach(video => {
        if (video.src && this.isMediaFile(video.src)) {
          mediaItems.push({
            url: this.resolveUrl(video.src, url.loc),
            name: this.getCleanFilename(video.src),
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
            name: this.getCleanFilename(source.src),
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
            name: this.getCleanFilename(href),
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

      console.log(`Page ${url.loc}: Found ${mediaItems.length} media items total`);
      return mediaItems;
    } catch (error) {
      console.error(`Error scanning page ${url.loc}:`, error);
      return [];
    }
  }

  resolveUrl(src, docPath) {
    console.log(`    → resolveUrl() called with src: "${src}", docPath: "${docPath}"`);
    
    if (!src) {
      console.log(`    → resolveUrl() returning null (no src)`);
      return null;
    }

    // Handle absolute URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      console.log(`    → resolveUrl() returning absolute URL as-is: "${src}"`);
      return src;
    }

    // Handle data URLs
    if (src.startsWith('data:')) {
      console.log(`    → resolveUrl() returning data URL as-is: "${src}"`);
      return src;
    }

    // Handle relative URLs using the document's base URL
    try {
      const docUrl = new URL(docPath);
      const resolvedUrl = new URL(src, docUrl);
      const result = resolvedUrl.toString();
      console.log(`    → resolveUrl() resolved relative URL: "${src}" + "${docPath}" = "${result}"`);
      return result;
    } catch (error) {
      console.warn(`Failed to resolve URL: ${src} against ${docPath}`, error);
      console.log(`    → resolveUrl() returning original src due to error: "${src}"`);
      return src; // Return original if resolution fails
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
    if (!url || typeof url !== 'string') return false;
    
    const mediaExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff', 'ico', // Images
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', // Videos
      'pdf', 'doc', 'docx', 'txt', 'rtf', // Documents
      'mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a' // Audio
    ];
    
    const extension = this.getFileExtension(url);
    return extension && mediaExtensions.includes(extension.toLowerCase());
  }

  getFileExtension(url) {
    if (!url) return '';
    
    try {
      // Remove query parameters and fragments using regex (more robust)
      const cleanUrl = url.split(/[?#]/)[0];
      
      // Extract the file extension
      const extension = cleanUrl.split('.').pop()?.toLowerCase() || '';
      
      // Validate the extension - ensure it's not empty and different from the entire URL
      // Also check it doesn't contain invalid characters (like spaces, slashes, etc.)
      if (!extension || extension === cleanUrl || /[^a-z0-9]/.test(extension)) {
        return '';
      }
      
      return extension;
    } catch (error) {
      console.warn('Error extracting file extension from URL:', url, error);
      return '';
    }
  }

  getCleanFilename(url) {
    if (!url) return '';
    
    try {
      // Remove query parameters and fragments first
      const cleanUrl = url.split(/[?#]/)[0];
      
      // Get the filename from the path
      const filename = cleanUrl.split('/').pop() || '';
      
      return filename;
    } catch (error) {
      console.warn('Error extracting clean filename from URL:', url, error);
      return '';
    }
  }

  fixLocalhostUrl(url, originalDomain) {
    if (!url || !originalDomain) return url;
    
    // Check if URL contains localhost
    if (url.includes('localhost:3003')) {
      console.log(`  → DEBUG: Detected localhost URL, attempting to fix: "${url}"`);
      
      try {
        // Extract the path and query parameters from localhost URL
        const localhostUrl = new URL(url);
        const pathAndQuery = localhostUrl.pathname + localhostUrl.search;
        
        // Construct new URL with original domain
        const fixedUrl = `https://${originalDomain}${pathAndQuery}`;
        
        console.log(`  → DEBUG: Fixed localhost URL: "${url}" → "${fixedUrl}"`);
        return fixedUrl;
      } catch (error) {
        console.warn('Error fixing localhost URL:', url, error);
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
      return urls; // No previous data, scan all URLs
    }

    const changedUrls = [];
    const pageLastModified = previousMetadata.pageLastModified;

    for (const url of urls) {
      const urlKey = url.loc;
      const previousLastMod = pageLastModified[urlKey];
      
      // If we don't have previous data for this URL, or if lastmod has changed, include it
      if (!previousLastMod || !url.lastmod || url.lastmod !== previousLastMod) {
        changedUrls.push(url);
      }
    }

    return changedUrls;
  }

  // Test method to debug HTML parsing
  testHtmlParsing(htmlString, baseUrl = 'https://example.com') {
    console.log('Testing HTML parsing with:', htmlString.substring(0, 200) + '...');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    const images = doc.querySelectorAll('img');
    console.log(`Found ${images.length} img tags in test HTML`);
    
    images.forEach((img, index) => {
      console.log(`  Test Image ${index + 1}: src="${img.src}", alt="${img.alt}"`);
      if (img.src) {
        const isMedia = this.isMediaFile(img.src);
        const extension = this.getFileExtension(img.src);
        console.log(`    → Extension: ${extension}, IsMedia: ${isMedia}`);
      }
    });
    
    return images.length;
  }

}

class Queue {
  constructor(callback, maxConcurrent = 20, onError = null) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrent = maxConcurrent;
    this.callback = callback;
    this.onError = onError;
  }

  async push(data) {
    this.queue.push(data);
    await this.processQueue();
  }

  async processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      await this.processItem(item);
    }
  }

  async processItem(item) {
    this.activeCount += 1;
    try {
      await this.callback(item);
    } catch (e) {
      if (this.onError) {
        this.onError(item, e);
      } else {
        throw e;
      }
    } finally {
      this.activeCount -= 1;
      await this.processQueue();
    }
  }
}

export { SitemapParser };
