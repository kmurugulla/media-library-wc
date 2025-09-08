// src/utils/sitemap-parser.js
import { analyzeImage, updateAnalysisConfig, getAnalysisConfig, clearAnalysisCache } from './image-analysis.js';

class SitemapParser {
  constructor(options = {}) {
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
    
    // Image analysis configuration
    this.enableImageAnalysis = options.enableImageAnalysis || false;
    this.analysisConfig = options.analysisConfig || {};
    
    // Configure image analysis if enabled
    if (this.enableImageAnalysis) {
      updateAnalysisConfig({
        enabled: true,
        ...this.analysisConfig
      });
    }
  }

  async autoDetectSitemap(websiteUrl) {
    try {
      // Generate URL variations to try
      const urlVariations = this.generateUrlVariations(websiteUrl);

      // Try each URL variation
      for (const baseUrl of urlVariations) {
        try {
          this.contentOrigin = baseUrl; // Set content origin for proper URL resolution

          // First, try to find sitemap in robots.txt
          const sitemapFromRobots = await this.findSitemapInRobots(baseUrl);
          if (sitemapFromRobots) {
            return sitemapFromRobots;
          }

          // If not found in robots.txt, try common sitemap paths
          for (const path of this.commonSitemapPaths) {
            if (path === '/robots.txt') continue; // Skip robots.txt as we already checked it
            
            const sitemapUrl = `${baseUrl}${path}`;
            try {
              const response = await fetch(sitemapUrl, { method: 'HEAD' });
              if (response.ok) {
                return sitemapUrl;
              }
            } catch (error) {
              // Continue to next path
            }
          }

        } catch (error) {
          // Continue to next URL variation
        }
      }

      // If no sitemap found in any variation, try to create a simple page list for the first working URL
      for (const baseUrl of urlVariations) {
        try {
          this.contentOrigin = baseUrl;
          return await this.createFallbackPageList(baseUrl);
        } catch (error) {
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
        ...config
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
      analysisConfig: getAnalysisConfig()
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
        // Return the first sitemap found
        const sitemapUrl = sitemapMatches[0].replace(/^Sitemap:\s*/i, '').trim();
        return sitemapUrl;
      }
      
      return null;
    } catch (error) {
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
        return sitemapUrl.pages;
      }

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
      
      // Process first few sitemaps to avoid overwhelming the system
      const maxSitemaps = Math.min(sitemapElements.length, 5);
      for (let i = 0; i < maxSitemaps; i++) {
        const sitemapElement = sitemapElements[i];
        const loc = sitemapElement.querySelector('loc');
        const lastmod = sitemapElement.querySelector('lastmod');
        
        if (loc && loc.textContent) {
          try {
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
      
      // DEBUG: Check for base tag or other URL rewriting
      const baseTag = doc.querySelector('base');
      if (baseTag) {
      }
      
      // DEBUG: Check if this is a development/staging environment
      const title = doc.querySelector('title');
      if (title) {
      }
      
      // DEBUG: Look for any meta tags that might indicate environment
      const metaTags = doc.querySelectorAll('meta[name*="env"], meta[name*="environment"], meta[property*="env"]');
      if (metaTags.length > 0) {
      }
      
      const mediaItems = [];
      const timestamp = new Date(url.lastmod).getTime();

      // Parse images
      const images = doc.querySelectorAll('img');
      
      // DEBUG: Log first few img src attributes to see what we're getting
      if (images.length > 0) {
      }
      
      for (let index = 0; index < images.length; index++) {
        const img = images[index];
        
        // Get the raw src attribute value, not the resolved URL
        const rawSrc = img.getAttribute('src');
        
        // Also check for common lazy loading data attributes
        const lazySrc = img.getAttribute('data-src') || 
                       img.getAttribute('data-lazy-src') || 
                       img.getAttribute('data-original') || 
                       img.getAttribute('data-sling-src') ||
                       img.getAttribute('data-responsive-src');
        
        const actualSrc = rawSrc || lazySrc;
        
        if (actualSrc && actualSrc.trim() !== '') {
          const isMedia = this.isMediaFile(actualSrc);
          const extension = this.getFileExtension(actualSrc);
          
          if (isMedia) {
            // DEBUG: Track URL transformation
            
            const resolvedUrl = this.resolveUrl(actualSrc, url.loc);
            
            // Extract domain from document URL for localhost fixing
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
              lastUsedAt: timestamp
            };

            // Run image analysis if enabled
            if (this.enableImageAnalysis) {
              try {
                const analysis = await analyzeImage(fixedUrl, null, mediaItem.ctx);
                
                // Add analysis results to media item
                mediaItem.orientation = analysis.orientation;
                mediaItem.category = analysis.category;
                mediaItem.categoryConfidence = analysis.categoryConfidence;
                mediaItem.categoryScore = analysis.categoryScore;
                mediaItem.categorySource = analysis.categorySource;
                mediaItem.width = analysis.width;
                mediaItem.height = analysis.height;
                mediaItem.exifCamera = analysis.exifCamera;
                mediaItem.exifDate = analysis.exifDate;
                mediaItem.hasFaces = analysis.hasFaces;
                mediaItem.faceCount = analysis.faceCount;
                mediaItem.dominantColor = analysis.dominantColor;
                mediaItem.analysisConfidence = analysis.confidence;
                
                // Add error information if EXIF extraction failed
                if (analysis.exifError) {
                  mediaItem.hasError = true;
                  mediaItem.errorType = analysis.exifError.errorType;
                  mediaItem.errorMessage = analysis.exifError.errorMessage;
                  mediaItem.statusCode = analysis.exifError.statusCode;
                  
                  // Set category to '404s' if it's a 404 error
                  if (analysis.exifError.errorType === '404') {
                    mediaItem.category = '404s';
                  }
                }
                
              } catch (error) {
                console.warn(`  → Image analysis failed for ${fixedUrl}:`, error);
                // Continue without analysis results
              }
            }

            mediaItems.push(mediaItem);
          }
        }
      }

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

      return mediaItems;
    } catch (error) {
      console.error(`Error scanning page ${url.loc}:`, error);
      return [];
    }
  }

  resolveUrl(src, docPath) {
    
    if (!src) {
      return null;
    }

    // Handle absolute URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    // Handle data URLs
    if (src.startsWith('data:')) {
      return src;
    }

    // Handle relative URLs using the document's base URL
    try {
      const docUrl = new URL(docPath);
      const resolvedUrl = new URL(src, docUrl);
      const result = resolvedUrl.toString();
      return result;
    } catch (error) {
      console.warn(`Failed to resolve URL: ${src} against ${docPath}`, error);
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

    // Add performance analysis tags
    const performanceTags = this.analyzePerformanceContext(element, type);
    if (performanceTags.length > 0) {
      context.push(`perf:${performanceTags.join(',')}`);
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

  /**
   * Analyze performance context and generate performance tags
   * @param {Element} element - The media element
   * @param {string} type - The element type (img, video, etc.)
   * @returns {Array<string>} Array of performance tags
   */
  analyzePerformanceContext(element, type) {
    const tags = [];

    // Only analyze images for now
    if (type !== 'img') {
      return tags;
    }


    // Position analysis
    const positionTags = this.analyzePosition(element);
    tags.push(...positionTags);

    // Loading strategy analysis
    const loadingTags = this.analyzeLoadingStrategy(element);
    tags.push(...loadingTags);

    // Responsive image analysis
    const responsiveTags = this.analyzeResponsiveImages(element);
    tags.push(...responsiveTags);

    // Format analysis
    const formatTags = this.analyzeFormat(element);
    tags.push(...formatTags);

    // Size analysis
    const sizeTags = this.analyzeSize(element);
    tags.push(...sizeTags);

    // Social media analysis
    const socialTags = this.analyzeSocialMedia(element);
    tags.push(...socialTags);

    // Overall optimization status
    const optimizationTags = this.analyzeOptimizationStatus(tags);
    tags.push(...optimizationTags);

    return tags;
  }

  /**
   * Analyze element position for performance tags
   */
  analyzePosition(element) {
    const tags = [];
    
    // Check for above-fold indicators
    const isAboveFold = this.isAboveFold(element);
    if (isAboveFold) {
      tags.push('above-fold');
    } else {
      tags.push('below-fold');
    }

    // Check for hero section indicators
    const isHeroSection = this.isHeroSection(element);
    if (isHeroSection) {
      tags.push('hero-section');
      tags.push('lcp-candidate');
    }

    // Check for critical content areas
    const isCritical = this.isCriticalContent(element);
    if (isCritical) {
      tags.push('critical-content');
    }

    return tags;
  }

  /**
   * Analyze loading strategy
   */
  analyzeLoadingStrategy(element) {
    const tags = [];
    
    const loading = element.getAttribute('loading');
    const fetchpriority = element.getAttribute('fetchpriority');
    
    if (loading === 'lazy') {
      tags.push('lazy-loading');
    } else if (loading === 'eager') {
      tags.push('eager-loading');
    } else {
      tags.push('no-loading-strategy');
    }

    if (fetchpriority === 'high') {
      tags.push('high-priority');
    } else if (fetchpriority === 'low') {
      tags.push('low-priority');
    }

    return tags;
  }

  /**
   * Analyze responsive image support
   */
  analyzeResponsiveImages(element) {
    const tags = [];
    
    const srcset = element.getAttribute('srcset');
    const sizes = element.getAttribute('sizes');
    
    if (srcset) {
      tags.push('has-srcset');
      tags.push('responsive');
      
      // Count number of sizes in srcset
      const sizeCount = srcset.split(',').length;
      if (sizeCount > 1) {
        tags.push('multiple-sizes');
      }
    } else {
      tags.push('no-srcset');
      tags.push('fixed-size');
    }

    if (sizes) {
      tags.push('has-sizes');
    } else {
      tags.push('no-sizes');
    }

    return tags;
  }

  /**
   * Analyze image format
   */
  analyzeFormat(element) {
    const tags = [];
    
    const src = element.getAttribute('src') || element.getAttribute('data-src') || '';
    const srcset = element.getAttribute('srcset') || '';
    
    // Check for modern formats
    if (src.includes('.webp') || srcset.includes('.webp')) {
      tags.push('webp-available');
    }
    
    if (src.includes('.avif') || srcset.includes('.avif')) {
      tags.push('avif-supported');
    }
    
    // Check for legacy formats
    if (src.match(/\.(jpg|jpeg|png|gif)$/i) && !srcset.includes('.webp') && !srcset.includes('.avif')) {
      tags.push('legacy-format');
    }
    
    if (src.includes('.webp') || src.includes('.avif')) {
      tags.push('modern-format');
    }

    return tags;
  }

  /**
   * Analyze image size optimization
   */
  analyzeSize(element) {
    const tags = [];
    
    // This is a simplified analysis - in a real implementation,
    // you might want to load the image to get actual dimensions
    const src = element.getAttribute('src') || element.getAttribute('data-src') || '';
    
    // Check for common oversized image patterns
    if (src.includes('1920') || src.includes('2048') || src.includes('2560')) {
      tags.push('large-size');
    }
    
    // Check for common optimized sizes
    if (src.includes('800') || src.includes('600') || src.includes('400')) {
      tags.push('optimized-size');
    }

    return tags;
  }

  /**
   * Analyze social media usage
   */
  analyzeSocialMedia(element) {
    const tags = [];
    
    // This would need to be enhanced to check against meta tags
    // For now, we'll do basic filename analysis
    const src = element.getAttribute('src') || element.getAttribute('data-src') || '';
    const filename = src.toLowerCase();
    
    if (filename.includes('og-') || filename.includes('social-') || filename.includes('share-')) {
      tags.push('social-image');
    }
    
    if (filename.includes('og-image') || filename.includes('ogimage')) {
      tags.push('og-image');
    }
    
    if (filename.includes('twitter-') || filename.includes('twitterimage')) {
      tags.push('twitter-image');
    }

    return tags;
  }

  /**
   * Analyze overall optimization status
   */
  analyzeOptimizationStatus(existingTags) {
    const tags = [];
    
    // Define specific optimization issues with actionable descriptions
    const optimizationIssues = {
      'no-srcset': 'add-responsive-images',
      'legacy-format': 'convert-to-webp',
      'no-loading-strategy': 'add-loading-attribute',
      'large-size': 'resize-image'
    };
    
    // Check for specific issues and add actionable tags
    Object.entries(optimizationIssues).forEach(([issue, action]) => {
      if (existingTags.includes(issue)) {
        tags.push(action);
      }
    });
    
    // Check if fully optimized
    const isFullyOptimized = existingTags.some(tag => 
      ['has-srcset', 'modern-format', 'lazy-loading', 'optimized-size'].includes(tag)
    );
    
    const hasAnyIssues = Object.keys(optimizationIssues).some(issue => 
      existingTags.includes(issue)
    );
    
    if (isFullyOptimized && !hasAnyIssues) {
      tags.push('fully-optimized');
    }
    
    // Critical performance issue for LCP candidates
    if (existingTags.includes('lcp-candidate') && hasAnyIssues) {
      tags.push('critical-performance-issue');
    }

    return tags;
  }

  /**
   * Check if element is above the fold
   */
  isAboveFold(element) {
    // Simplified above-fold detection based on CSS classes and context
    const classes = element.className || '';
    const parentClasses = element.parentElement?.className || '';
    const grandparentClasses = element.parentElement?.parentElement?.className || '';
    const allClasses = `${classes} ${parentClasses} ${grandparentClasses}`.toLowerCase();
    
    // Common above-fold indicators
    const aboveFoldIndicators = [
      'hero', 'banner', 'header', 'navigation', 'nav', 'top', 'above', 'fold',
      'main', 'primary', 'featured', 'lead', 'intro', 'welcome',
      'article', 'card', 'content' // Add article and content indicators
    ];
    
    // Check for below-fold indicators (these override above-fold)
    const belowFoldIndicators = [
      'footer', 'sidebar', 'bottom', 'end', 'conclusion'
    ];
    
    const isBelowFold = belowFoldIndicators.some(indicator => allClasses.includes(indicator));
    if (isBelowFold) return false;
    
    // If it's in main content area (like articles), consider it above fold
    const isMainContent = aboveFoldIndicators.some(indicator => allClasses.includes(indicator));
    
    // Default to above-fold for images in main content areas
    return isMainContent;
  }

  /**
   * Check if element is in a hero section
   */
  isHeroSection(element) {
    const classes = element.className || '';
    const parentClasses = element.parentElement?.className || '';
    const allClasses = `${classes} ${parentClasses}`.toLowerCase();
    
    const heroIndicators = [
      'hero', 'banner', 'jumbotron', 'masthead', 'header-image', 'main-image'
    ];
    
    return heroIndicators.some(indicator => allClasses.includes(indicator));
  }

  /**
   * Check if element is in critical content
   */
  isCriticalContent(element) {
    const classes = element.className || '';
    const parentClasses = element.parentElement?.className || '';
    const allClasses = `${classes} ${parentClasses}`.toLowerCase();
    
    const criticalIndicators = [
      'main', 'primary', 'content', 'article', 'post', 'featured', 'important'
    ];
    
    return criticalIndicators.some(indicator => allClasses.includes(indicator));
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
    
    // Check if URL contains localhost (any port)
    if (url.includes('localhost:')) {
      
      try {
        // Extract the path and query parameters from localhost URL
        const localhostUrl = new URL(url);
        const pathAndQuery = localhostUrl.pathname + localhostUrl.search;
        
        // Construct new URL with original domain
        const fixedUrl = `https://${originalDomain}${pathAndQuery}`;
        
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
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    const images = doc.querySelectorAll('img');
    
    // Test context extraction for each image
    images.forEach((img, index) => {
      // Test context extraction
      const context = this.captureContext(img, 'img');
      console.log(`Image ${index + 1} context:`, context);
      
      // Test performance analysis specifically
      const performanceTags = this.analyzePerformanceContext(img, 'img');
      console.log(`Image ${index + 1} performance tags:`, performanceTags);
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

// Expose cache clearing function to window for debugging
if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}
