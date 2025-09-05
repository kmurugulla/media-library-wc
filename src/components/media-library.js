// src/components/media-library.js
import { html, css } from 'lit';
import { LocalizableElement } from './base-localizable.js';
import { i18n } from '../utils/i18n.js';
import { BrowserStorage } from '../utils/storage.js';
import { SitemapParser } from '../utils/sitemap-parser.js';
import { processMediaData, calculateFilteredMediaData } from '../utils/filters.js';
import { copyMediaToClipboard } from '../utils/utils.js';
import './topbar/topbar.js';
import './sidebar/sidebar.js';
import './grid/grid.js';
import './list/list.js';
import './modal-manager/modal-manager.js';
import getSvg from '../utils/getSvg.js';

class MediaLibrary extends LocalizableElement {
  static properties = {
    source: { type: String },
    sitemapUrl: { type: String },
    storage: { type: String },
    locale: { type: String },
    _mediaData: { state: true },
    _error: { state: true },
    _searchQuery: { state: true },
    _selectedFilterType: { state: true },
    _currentView: { state: true },
    _isScanning: { state: true },
    _scanProgress: { state: true },
    _lastScanDuration: { state: true },
    _scanStats: { state: true }
  };

  static styles = css`
    @layer base {
      :host {
        --ml-primary: #3b82f6;
        --ml-primary-hover: #2563eb;
        --ml-surface: #ffffff;
        --ml-surface-elevated: #f8fafc;
        --ml-border: #e2e8f0;
        --ml-text: #1e293b;
        --ml-text-muted: #64748b;
        --ml-space-xs: 0.25rem;
        --ml-space-sm: 0.5rem;
        --ml-space-md: 1rem;
        --ml-space-lg: 1.5rem;
        --ml-space-xl: 2rem;
        --ml-radius-sm: 0.25rem;
        --ml-radius-md: 0.375rem;
        --ml-radius-lg: 0.5rem;
        --ml-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        --ml-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        
        display: block;
        width: 100%;
        max-width: 100%;
        margin: 0;
        height: 100vh;
        overflow: hidden;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      /* Franklin-style SVG handling */
      :host > svg {
        display: none;
      }
      
      /* Icon styles */
      .error-icon {
        display: block;
        width: 48px;
        height: 48px;
        margin-bottom: var(--ml-space-md);
        color: #ef4444;
      }
    }

    @layer components {
      .media-library {
        display: grid;
        grid-template:
          "sidebar topbar" auto
          "sidebar main" 1fr
          / 240px 1fr;
        height: 100vh;
        width: 100%;
        max-width: 100%;
        background: var(--ml-surface-elevated);
        overflow: hidden;
        position: relative;
        gap: var(--ml-space-sm);
        padding: 0;
      }

      .top-bar {
        grid-area: topbar;
        background: var(--ml-surface);
        border: 1px solid var(--ml-border);
        border-radius: var(--ml-radius-lg);
        box-shadow: var(--ml-shadow-sm);
        z-index: 1000;
      }

      .sidebar {
        grid-area: sidebar;
        background: var(--ml-surface);
        border: 1px solid var(--ml-border);
        border-radius: var(--ml-radius-lg);
        box-shadow: var(--ml-shadow-sm);
        overflow-y: auto;
      }

      .main-content {
        grid-area: main;
        background: var(--ml-surface);
        border: 1px solid var(--ml-border);
        border-radius: var(--ml-radius-lg);
        box-shadow: var(--ml-shadow-sm);
        overflow: hidden;
        position: relative;
      }

      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--ml-space-xl);
        text-align: center;
        color: var(--ml-text-muted);
        max-width: 800px;
        margin: 0 auto;
      }

      .error-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: var(--ml-space-md);
        color: #ef4444;
      }

      .error-message {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: var(--ml-radius-md);
        padding: var(--ml-space-lg);
        margin: var(--ml-space-md) 0;
        text-align: left;
        white-space: pre-line;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--ml-text);
        max-width: 100%;
        overflow-wrap: break-word;
      }

      .retry-button {
        background: var(--ml-primary);
        color: white;
        border: none;
        border-radius: var(--ml-radius-md);
        padding: var(--ml-space-sm) var(--ml-space-lg);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: var(--ml-transition);
        margin-top: var(--ml-space-md);
      }

      .retry-button:hover {
        background: var(--ml-primary-hover);
        transform: translateY(-1px);
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--ml-space-lg);
        text-align: center;
        color: var(--ml-text-muted);
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--ml-border);
        border-top: 3px solid var(--ml-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: var(--ml-space-md);
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    }

    @media (max-width: 768px) {
      .media-library {
        grid-template:
          "topbar" auto
          "main" 1fr
          / 1fr;
      }
      
      .sidebar {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this.source = '';
    this.sitemapUrl = '';
    this.storage = 'indexeddb';
    this.locale = 'en';
    this._mediaData = [];
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._currentView = 'grid';
    this._isScanning = false;
    this._scanProgress = null;
    
    this.storageManager = null;
    this.sitemapParser = null;
    this._processedData = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    
    // Load SVG icons for all child components
    const ICONS = [
      '/src/icons/close.svg',
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/pdf.svg',
      '/src/icons/external-link.svg',
      '/src/icons/copy.svg'
    ];
    
    await getSvg({ parent: this.shadowRoot, paths: ICONS });
    
    // Initialize i18n
    await i18n.loadLocale(this.locale);
    i18n.setLocale(this.locale);
    
    // Initialize storage
    this.storageManager = new BrowserStorage(this.storage);
    
    // Initialize sitemap parser
    this.sitemapParser = new SitemapParser();
    
    // Load existing data
    await this.loadMediaData();
  }

  updated(changedProperties) {
    // Don't automatically set locale here as it causes update loops
    // Locale will be set during connectedCallback
  }

  async initialize() {
    try {
      this._error = null;
      await this.loadMediaData();
    } catch (error) {
      this._error = error.message;
      console.error('Failed to initialize media library:', error);
    }
  }

  async loadMediaData(siteKey = null) {
    try {
      if (!this.storageManager) {
        console.warn('Storage manager not initialized yet');
        return;
      }
      
      // Use provided site key or generate from current source
      const key = siteKey || (this.source ? this.generateSiteKey(this.source) : 'media-data');
      const data = await this.storageManager.load(key);
      if (data && data.length > 0) {
        this._mediaData = data;
        this._processedData = processMediaData(data);
      } else {
        // Initialize with empty data if no data is found
        this._mediaData = [];
        this._processedData = processMediaData([]);
      }
    } catch (error) {
      console.error('Failed to load media data:', error);
      
      // Initialize with empty data as fallback
      this._mediaData = [];
      this._processedData = processMediaData([]);
      
      // Only set error if it's a critical failure
      if (error.name !== 'NotFoundError' && !error.message.includes('object store')) {
        this._error = this.t('errors.loadFailed');
      }
    }
  }

  async handleScan() {
    if (!this.source) {
      this._error = this.t('errors.invalidSource');
      return;
    }

    try {
      this._isScanning = true;
      this._error = null;
      this._scanStartTime = Date.now();
      
      // Use manual sitemap URL if provided, otherwise auto-detect
      let sitemapUrl = this.source;
      if (this.sitemapUrl && this.sitemapUrl.trim()) {
        console.log('Using manual sitemap URL:', this.sitemapUrl);
        sitemapUrl = this.sitemapUrl;
      } else if (this.isWebsiteUrl(this.source)) {
        console.log('Website URL detected, auto-detecting sitemap...');
        sitemapUrl = await this.sitemapParser.autoDetectSitemap(this.source);
        console.log(`Auto-detected sitemap: ${sitemapUrl}`);
      }
      
      // Parse sitemap
      const urls = await this.sitemapParser.parseSitemap(sitemapUrl);
      console.log(`Parsed sitemap: Found ${urls.length} URLs to scan`);
      console.log('First few URLs:', urls.slice(0, 3).map(u => u.loc));
      
      if (urls.length === 0) {
        this._error = 'No URLs found in sitemap. This could be because:\n• The sitemap is empty\n• The sitemap contains only sitemap indexes (nested sitemaps)\n• CORS restrictions are blocking access to nested sitemaps\n• The sitemap format is not supported\n\nFor sites without sitemaps (like Medium.com), the scanner will try to access common pages instead.';
        return;
      }

      // Load previous scan metadata for incremental scanning
      const siteKey = this.generateSiteKey(this.source);
      const previousMetadata = await this.storageManager.loadScanMetadata(siteKey);

      // Scan pages with progress updates and incremental scanning
      const mediaData = await this.sitemapParser.scanPages(urls, (completed, total, found) => {
        this._scanProgress = { pages: completed, total, found };
        this.requestUpdate();
      }, previousMetadata);

      // Calculate scan duration
      const scanDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (scanDuration / 1000).toFixed(1);
      
      // Save to storage with site key
      await this.storageManager.save(mediaData, siteKey);
      
      // Save scan metadata for incremental scanning
      const pageLastModified = {};
      urls.forEach(url => {
        pageLastModified[url.loc] = url.lastmod;
      });
      
      await this.storageManager.saveScanMetadata(siteKey, {
        sitemapUrl: sitemapUrl,
        totalPages: urls.length,
        pageLastModified: pageLastModified,
        scanDuration: scanDuration
      });
      
      // Update component state
      this._mediaData = mediaData;
      this._processedData = processMediaData(mediaData);
      this._isScanning = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;
      
      // Update scan statistics
      this._scanStats = {
        pagesScanned: urls.length,
        mediaFound: mediaData.length,
        duration: durationSeconds
      };
      
      // Show success message with duration
      this.showNotification(`Scan complete: ${mediaData.length} items found in ${durationSeconds}s`);
      
      // Refresh available sites list if in test environment
      if (typeof window.refreshSites === 'function') {
        window.refreshSites();
      }
      
    } catch (error) {
      this._isScanning = false;
      this._scanProgress = null;
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch')) {
        this._error = `Failed to fetch sitemap from: ${this.source}\n\nError: ${error.message}\n\nThis is likely due to:\n• CORS (Cross-Origin Resource Sharing) restrictions\n• The site blocking requests from your domain\n• Network connectivity issues\n• Invalid sitemap URL\n\nTry using a different sitemap URL or test with a local sitemap.`;
      } else if (error.message.includes('Failed to fetch sitemap')) {
        this._error = `Failed to fetch sitemap: ${error.message}\n\nThis could be due to:\n• CORS restrictions\n• Network connectivity issues\n• Invalid sitemap URL\n• Server blocking the request`;
      } else if (error.message.includes('Invalid XML')) {
        this._error = `Invalid XML in sitemap: ${error.message}\n\nThe sitemap may be malformed or not a valid XML document.`;
      } else {
        this._error = `Scan failed: ${error.message}\n\nFull error details: ${JSON.stringify(error, null, 2)}`;
      }
      
      console.error('Scan failed:', error);
    }
  }

  get filteredMediaData() {
    return calculateFilteredMediaData(
      this._mediaData,
      this._selectedFilterType,
      this._searchQuery,
      this.selectedDocument
    );
  }
  
  addUsageCountToMedia(mediaData) {
    if (!mediaData) return [];
    
    // Group by URL to count usage across different documents
    const usageCounts = {};
    const uniqueDocs = {};
    
    mediaData.forEach(item => {
      if (item.url) {
        if (!usageCounts[item.url]) {
          usageCounts[item.url] = 0;
          uniqueDocs[item.url] = new Set();
        }
        
        // Count unique documents where this media is used
        if (item.doc && item.doc.trim()) {
          uniqueDocs[item.url].add(item.doc);
        }
      }
    });
    
    // Set usage count to number of unique documents
    Object.keys(usageCounts).forEach(url => {
      usageCounts[url] = uniqueDocs[url].size || 1;
    });
    
    // Add usage count to each unique media item
    const uniqueMedia = {};
    mediaData.forEach(item => {
      if (item.url && !uniqueMedia[item.url]) {
        uniqueMedia[item.url] = {
          ...item,
          usageCount: usageCounts[item.url] || 1
        };
      }
    });
    
    return Object.values(uniqueMedia);
  }

  get selectedDocument() {
    if (this._mediaData && this._mediaData.length > 0) {
      const indexDoc = this._mediaData.find((media) => media.doc === '/index.html');
      if (indexDoc) {
        return '/index.html';
      }

      const firstDoc = this._mediaData.find((media) => media.doc && media.doc.trim());
      if (firstDoc) {
        return firstDoc.doc;
      }
    }

    return null;
  }

  get filterCounts() {
    return this._processedData?.filterCounts || {};
  }

  handleSearch(e) {
    this._searchQuery = e.detail.query;
  }

  handleViewChange(e) {
    this._currentView = e.detail.view;
  }

  handleFilter(e) {
    this._selectedFilterType = e.detail.type;
  }

  async handleMediaClick(e) {
    const { media } = e.detail;
    if (!media) return;

    // Pre-filter usage data for the modal
    const usageData = this._mediaData
      ?.filter((item) => item.url === media.url && item.doc && item.doc.trim())
      .map((item) => ({
        doc: item.doc,
        alt: item.alt,
        type: item.type,
        firstUsedAt: item.firstUsedAt,
        lastUsedAt: item.lastUsedAt,
      })) || [];

    // Open modal
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: {
        type: 'details',
        data: {
          media,
          usageData
        }
      }
    }));
  }

  async handleMediaAction(e) {
    const { action, media } = e.detail;
    
    if (action === 'copy') {
      await this.handleCopyMedia(media);
    }
  }

  async handleCopyMedia(media) {
    try {
      const result = await copyMediaToClipboard(media);
      this.showNotification(result.heading, result.message, 'success');
    } catch (error) {
      this.showNotification(this.t('common.error'), this.t('errors.saveFailed'), 'error');
    }
  }

  showNotification(heading, message, type = 'info') {
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: {
        heading,
        message,
        type,
        open: true
      }
    }));
  }

  render() {
    return html`
      <div class="media-library">
        <div class="top-bar">
          <media-topbar
            .searchQuery=${this._searchQuery}
            .currentView=${this._currentView}
            .locale=${this.locale}
            .isScanning=${this._isScanning}
            .scanProgress=${this._scanProgress}
            .lastScanDuration=${this._lastScanDuration}
            .scanStats=${this._scanStats}
            @search=${this.handleSearch}
            @viewChange=${this.handleViewChange}
            @scan=${this.handleScan}
          ></media-topbar>
        </div>

        <div class="sidebar">
          <media-sidebar
            .activeFilter=${this._selectedFilterType}
            .filterCounts=${this.filterCounts}
            .locale=${this.locale}
            @filter=${this.handleFilter}
          ></media-sidebar>
        </div>

        <div class="main-content">
          ${this._error ? this.renderErrorState() : this.renderCurrentView()}
        </div>

        <modal-manager .locale=${this.locale}></modal-manager>
      </div>
    `;
  }

  renderErrorState() {
    return html`
      <div class="error-state">
        <svg class="error-icon">
          <use href="#close"></use>
        </svg>
        <h3>${this.t('common.error')}</h3>
        <div class="error-message">${this._error}</div>
        <button class="retry-button" @click=${() => this.clearError()}>
          Try Again
        </button>
      </div>
    `;
  }

  clearError() {
    this._error = null;
  }

  isWebsiteUrl(url) {
    if (!url) return false;
    
    // Check if it's already a sitemap URL
    if (url.includes('/sitemap') || url.endsWith('.xml')) {
      return false;
    }
    
    // Check if it looks like a website URL (has domain)
    const urlPattern = /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/.*)?$/i;
    return urlPattern.test(url);
  }

  generateSiteKey(source) {
    if (!source) return 'media-data';
    
    try {
      // If it's a full URL, extract the domain
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const url = new URL(source);
        return url.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
      }
      
      // If it's just a domain, clean it up
      return source.replace(/[^a-zA-Z0-9.-]/g, '_');
    } catch (error) {
      // Fallback to cleaned source
      return source.replace(/[^a-zA-Z0-9.-]/g, '_');
    }
  }

  renderCurrentView() {
    if (this._isScanning) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <h3>${this.t('mediaLibrary.scanning')}</h3>
          <p>${this.t('mediaLibrary.scanProgress', { count: this._scanProgress?.pages || 0 })}</p>
        </div>
      `;
    }

    const mediaWithUsageCount = this.addUsageCountToMedia(this.filteredMediaData);

    if (this._currentView === 'list') {
      return html`
        <media-list
          .mediaData=${mediaWithUsageCount}
          .searchQuery=${this._searchQuery}
          .locale=${this.locale}
          @mediaClick=${this.handleMediaClick}
          @mediaAction=${this.handleMediaAction}
        ></media-list>
      `;
    }
    
    return html`
      <media-grid
        .mediaData=${mediaWithUsageCount}
        .searchQuery=${this._searchQuery}
        .locale=${this.locale}
        @mediaClick=${this.handleMediaClick}
        @mediaAction=${this.handleMediaAction}
      ></media-grid>
    `;
  }
}

customElements.define('media-library', MediaLibrary);

export default MediaLibrary;
