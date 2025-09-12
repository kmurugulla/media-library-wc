// src/components/media-library.js
import { html } from 'lit';
import LocalizableElement from './base-localizable.js';
import i18n from '../utils/i18n.js';
import BrowserStorage from '../utils/storage.js';
import ContentParser from '../utils/parser.js';
import { processMediaData, calculateFilteredMediaData } from '../utils/filters.js';
import { copyMediaToClipboard, urlsMatch } from '../utils/utils.js';
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
    this.storage = 'indexeddb';
    this.locale = 'en';
    this._mediaData = [];
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._currentView = 'grid';
    this._isScanning = false;
    this._scanProgress = null;
    this._imageAnalysisEnabled = false;

    this.storageManager = null;
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
    this.contentParser = new ContentParser({
      enableImageAnalysis: this._imageAnalysisEnabled,
      enableCategorization: true, // Always enabled by default
      analysisConfig: {
        extractEXIF: true,
        extractDimensions: true,
        categorizeFromFilename: true,
      },
      categorizationConfig: {
        useFilename: true,
        useContext: true,
        useAltText: true,
        usePosition: true,
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

      const key = siteKey || 'media-data';
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

  /**
   * Load media data from a list of pages
   * @param {Array} pageList - Array of page objects with url, lastmod, etc.
   * @param {Function} onProgress - Progress callback function
   * @param {string} siteKey - Optional site key for storage
   * @returns {Promise<Array>} Array of media data
   */
  async loadFromPageList(pageList, onProgress = null, siteKey = null) {
    if (!pageList || pageList.length === 0) {
      this._error = 'No pages provided to scan';
      return [];
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

      const storageKey = siteKey || 'media-data';
      const previousMetadata = await this.storageManager.loadScanMetadata(storageKey);

      this._scanProgress = { current: 0, total: pageList.length, found: 0 };
      this.requestUpdate();

      const progressCallback = (completed, total, found) => {
        this._scanProgress = { current: completed, total, found };
        this.requestUpdate();
        if (onProgress) {
          onProgress(completed, total, found);
        }
      };

      const mediaData = await this.contentParser.scanPages(
        pageList,
        progressCallback,
        previousMetadata,
      );

      const scanDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (scanDuration / 1000).toFixed(1);

      await this.storageManager.save(mediaData, storageKey);
      const pageLastModified = {};
      pageList.forEach((page) => {
        pageLastModified[page.loc || page.url] = page.lastmod;
      });

      await this.storageManager.saveScanMetadata(storageKey, {
        totalPages: pageList.length,
        pageLastModified,
        scanDuration,
      });

      this._mediaData = mediaData;
      this._processedData = processMediaData(mediaData);
      this._isScanning = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;

      this._scanStats = {
        pagesScanned: pageList.length,
        mediaFound: mediaData.length,
        duration: durationSeconds,
      };

      if (typeof window.refreshSites === 'function') {
        window.refreshSites();
      }

      return mediaData;
    } catch (error) {
      this._isScanning = false;
      this._scanProgress = null;
      this._error = `Scan failed: ${error.message}`;
      throw error;
    }
  }

  /**
   * Load media data from storage
   * @param {string} siteKey - Site key to load data for
   * @returns {Promise<Array>} Array of media data
   */
  async loadFromStorage(siteKey) {
    await this.loadMediaData(siteKey);
    return this._mediaData;
  }

  /**
   * Clear all media data
   */
  clearData() {
    this._mediaData = [];
    this._processedData = processMediaData([]);
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._scanStats = null;
    this._lastScanDuration = null;
    this.requestUpdate();
  }

  /**
   * Generate a site key from a source URL
   * @param {string} source - Source URL or identifier
   * @returns {string} Generated site key
   */
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

  handleToggleImageAnalysis(event) {
    this._imageAnalysisEnabled = event.detail.enabled;

    if (this.contentParser) {
      this.contentParser.setImageAnalysis(this._imageAnalysisEnabled, {
        extractEXIF: true,
        extractDimensions: true,
        categorizeFromFilename: true,
      });
    }
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
    const urlGroups = {};

    // Group items by matching URLs
    mediaData.forEach((item) => {
      if (item.url) {
        let groupKey = null;

        // Find existing group for this URL
        for (const existingKey of Object.keys(urlGroups)) {
          if (urlsMatch(item.url, existingKey)) {
            groupKey = existingKey;
            break;
          }
        }

        // If no existing group found, create new one
        if (!groupKey) {
          groupKey = item.url;
          urlGroups[groupKey] = [];
        }

        urlGroups[groupKey].push(item);
        usageCounts[groupKey] = (usageCounts[groupKey] || 0) + 1;
      }
    });

    // Create unique media items using the first item from each group
    const uniqueMedia = {};
    Object.keys(urlGroups).forEach((groupKey) => {
      const group = urlGroups[groupKey];
      const firstItem = group[0];

      uniqueMedia[groupKey] = {
        ...firstItem,
        usageCount: usageCounts[groupKey] || 1,
      };
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
