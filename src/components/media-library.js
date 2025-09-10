// src/components/media-library.js
import { html } from 'lit';
import LocalizableElement from './base-localizable.js';
import i18n from '../utils/i18n.js';
import BrowserStorage from '../utils/storage.js';
import SitemapDiscovery from '../utils/sitemap.js';
import ContentParser from '../utils/parser.js';
import { processMediaData, calculateFilteredMediaData } from '../utils/filters.js';
import { copyMediaToClipboard } from '../utils/utils.js';
import { getStyles } from '../utils/get-styles.js';
import './topbar/topbar.js';
import './sidebar/sidebar.js';
import './grid/grid.js';
import './list/list.js';
import './modal-manager/modal-manager.js';
import getSvg from '../utils/get-svg.js';
import mediaLibraryStyles from './media-library.css?inline';

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
    _scanStats: { state: true },
    _imageAnalysisEnabled: { state: true },
  };

  static styles = getStyles(mediaLibraryStyles);

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
    this._imageAnalysisEnabled = true;

    this.storageManager = null;
    this.sitemapDiscovery = null;
    this.contentParser = null;
    this._processedData = null;
  }

  async connectedCallback() {
    super.connectedCallback();

    const ICONS = [
      '/src/icons/close.svg',
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/pdf.svg',
      '/src/icons/external-link.svg',
      '/src/icons/copy.svg',
    ];

    await getSvg({ parent: this.shadowRoot, paths: ICONS });

    await i18n.loadLocale(this.locale);
    i18n.setLocale(this.locale);

    this.storageManager = new BrowserStorage(this.storage);
    this.sitemapDiscovery = new SitemapDiscovery();
    this.contentParser = new ContentParser({
      enableImageAnalysis: this._imageAnalysisEnabled,
      analysisConfig: {
        extractEXIF: true,
        extractDimensions: true,
        categorizeFromFilename: true,
      },
    });

    await this.loadMediaData();
  }

  async updated(changedProperties) {
    if (changedProperties.has('locale')) {
      await i18n.loadLocale(this.locale);
      i18n.setLocale(this.locale);
    }
  }

  async initialize() {
    try {
      this._error = null;
      await this.loadMediaData();
    } catch (error) {
      this._error = error.message;
      // Failed to initialize media library
    }
  }

  async loadMediaData(siteKey = null) {
    try {
      if (!this.storageManager) {
        // Storage manager not initialized yet
        return;
      }

      const key = siteKey || (this.source ? this.generateSiteKey(this.source) : 'media-data');
      const data = await this.storageManager.load(key);
      if (data && data.length > 0) {
        this._mediaData = data;
        this._processedData = processMediaData(data);
      } else {
        this._mediaData = [];
        this._processedData = processMediaData([]);
      }
    } catch (error) {
      // Failed to load media data

      this._mediaData = [];
      this._processedData = processMediaData([]);
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
      this._mediaData = [];
      this._processedData = null;
      this._searchQuery = '';
      this._selectedFilterType = 'all';
      this._scanStartTime = Date.now();
      this._scanProgress = { current: 0, total: 0, found: 0 };
      this._lastScanDuration = null;
      this._scanStats = null;

      window.dispatchEvent(new CustomEvent('clear-search'));
      window.dispatchEvent(new CustomEvent('clear-filters'));
      let sitemapUrl = this.source;
      if (this.sitemapUrl && this.sitemapUrl.trim()) {
        // Using manual sitemap URL
        sitemapUrl = this.sitemapUrl;
      } else if (this.isWebsiteUrl(this.source)) {
        // Website URL detected, auto-detecting sitemap
        sitemapUrl = await this.sitemapDiscovery.autoDetectSitemap(this.source);
        // Auto-detected sitemap
      }

      const urls = await this.sitemapDiscovery.parseSitemap(sitemapUrl);
      // Parsed sitemap: Found URLs to scan
      // First few URLs processed

      if (urls.length === 0) {
        this._error = 'No URLs found in sitemap. This could be because:\n• The sitemap is empty\n• The sitemap contains only sitemap indexes (nested sitemaps)\n• CORS restrictions are blocking access to nested sitemaps\n• The sitemap format is not supported\n\nFor sites without sitemaps (like Medium.com), the scanner will try to access common pages instead.';
        return;
      }

      const siteKey = this.generateSiteKey(this.source);
      const previousMetadata = await this.storageManager.loadScanMetadata(siteKey);

      this._scanProgress = { current: 0, total: urls.length, found: 0 };
      this.requestUpdate();
      const mediaData = await this.contentParser.scanPages(urls, (completed, total, found) => {
        this._scanProgress = { current: completed, total, found };
        this.requestUpdate();
      }, previousMetadata);

      const scanDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (scanDuration / 1000).toFixed(1);

      await this.storageManager.save(mediaData, siteKey);
      const pageLastModified = {};
      urls.forEach((url) => {
        pageLastModified[url.loc] = url.lastmod;
      });

      await this.storageManager.saveScanMetadata(siteKey, {
        sitemapUrl,
        totalPages: urls.length,
        pageLastModified,
        scanDuration,
      });

      this._mediaData = mediaData;
      this._processedData = processMediaData(mediaData);
      this._isScanning = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;

      this._scanStats = {
        pagesScanned: urls.length,
        mediaFound: mediaData.length,
        duration: durationSeconds,
      };

      this.showNotification(`Scan complete: ${mediaData.length} items found in ${durationSeconds}s`);
      if (typeof window.refreshSites === 'function') {
        window.refreshSites();
      }
    } catch (error) {
      this._isScanning = false;
      this._scanProgress = null;

      if (error.message.includes('Failed to fetch')) {
        this._error = `Failed to fetch sitemap from: ${this.source}\n\nError: ${error.message}\n\nThis is likely due to:\n• CORS (Cross-Origin Resource Sharing) restrictions\n• The site blocking requests from your domain\n• Network connectivity issues\n• Invalid sitemap URL\n\nTry using a different sitemap URL or test with a local sitemap.`;
      } else if (error.message.includes('Failed to fetch sitemap')) {
        this._error = `Failed to fetch sitemap: ${error.message}\n\nThis could be due to:\n• CORS restrictions\n• Network connectivity issues\n• Invalid sitemap URL\n• Server blocking the request`;
      } else if (error.message.includes('Invalid XML')) {
        this._error = `Invalid XML in sitemap: ${error.message}\n\nThe sitemap may be malformed or not a valid XML document.`;
      } else {
        this._error = `Scan failed: ${error.message}\n\nFull error details: ${JSON.stringify(error, null, 2)}`;
      }

      // Scan failed
    }
  }

  handleToggleImageAnalysis(event) {
    this._imageAnalysisEnabled = event.detail.enabled;

    if (this.contentParser) {
      this.contentParser.setImageAnalysis(this._imageAnalysisEnabled, {
        extractEXIF: true,
        extractDimensions: true,
        categorizeFromFilename: true,
      });
    }

    const status = this._imageAnalysisEnabled ? 'enabled' : 'disabled';
    this.showNotification(`Image analysis ${status}. ${this._imageAnalysisEnabled ? 'Next scan will include image analysis.' : 'Next scan will be faster without analysis.'}`);
  }

  get filteredMediaData() {
    return calculateFilteredMediaData(
      this._mediaData,
      this._selectedFilterType,
      this._searchQuery,
      this.selectedDocument,
    );
  }

  addUsageCountToMedia(mediaData) {
    if (!mediaData) return [];

    const usageCounts = {};

    mediaData.forEach((item) => {
      if (item.url) {
        if (!usageCounts[item.url]) {
          usageCounts[item.url] = 0;
        }

        usageCounts[item.url] += 1;
      }
    });

    const uniqueMedia = {};
    mediaData.forEach((item) => {
      if (item.url && !uniqueMedia[item.url]) {
        uniqueMedia[item.url] = {
          ...item,
          usageCount: usageCounts[item.url] || 1,
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

    const usageData = this._mediaData
      ?.filter((item) => item.url === media.url && item.doc && item.doc.trim())
      .map((item) => ({
        doc: item.doc,
        alt: item.alt,
        type: item.type,
        ctx: item.ctx,
        firstUsedAt: item.firstUsedAt,
        lastUsedAt: item.lastUsedAt,
      })) || [];

    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: {
        type: 'details',
        data: {
          media,
          usageData,
          source: this.source,
        },
      },
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
        open: true,
      },
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
            .imageAnalysisEnabled=${this._imageAnalysisEnabled}
            .mediaData=${this._mediaData}
            @search=${this.handleSearch}
            @viewChange=${this.handleViewChange}
            @scan=${this.handleScan}
            @toggleImageAnalysis=${this.handleToggleImageAnalysis}
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

    if (url.includes('/sitemap') || url.endsWith('.xml')) {
      return false;
    }
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    return urlPattern.test(url);
  }

  isSitemapSource() {
    if (!this.source) return false;

    // Check if source is a sitemap URL
    if (this.source.includes('/sitemap') || this.source.endsWith('.xml')) {
      return true;
    }

    // Check if we have a manual sitemap URL set
    if (this.sitemapUrl && this.sitemapUrl.trim()) {
      return true;
    }

    return false;
  }

  generateSiteKey(source) {
    if (!source) return 'media-data';

    try {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const url = new URL(source);
        return url.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
      }

      return source.replace(/[^a-zA-Z0-9.-]/g, '_');
    } catch (error) {
      return source.replace(/[^a-zA-Z0-9.-]/g, '_');
    }
  }

  renderCurrentView() {
    if (this._isScanning) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <h3>${this.t('mediaLibrary.scanning')}</h3>
          <p>${this._scanProgress?.current === 0
    ? this.t('mediaLibrary.scanStarting')
    : this.t('mediaLibrary.scanProgress', {
      current: this._scanProgress?.current || 0,
      total: this._scanProgress?.total || 0,
    })
}</p>
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
