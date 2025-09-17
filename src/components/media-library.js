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
import './scan/scan.js';
import './modal-manager/modal-manager.js';
import getSvg from '../utils/get-svg.js';
import mediaLibraryStyles from './media-library.css?inline';

import { waitForMediaLibraryReady, createMediaLibrary, initializeMediaLibrary } from '../utils/initializer.js';

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
    _isBatchLoading: { state: true },
    _realTimeStats: { state: true },
    _progressiveMediaData: { state: true },
    _progressiveLimit: { state: true },
    showAnalysisToggle: { type: Boolean },
  };

  static styles = getStyles(mediaLibraryStyles);

  constructor() {
    super();
    this.storage = 'none';
    this.locale = 'en';
    this._mediaData = [];
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._currentView = 'grid';
    this._isScanning = false;
    this._scanProgress = null;
    this._imageAnalysisEnabled = false;
    this._isBatchLoading = false;
    this._realTimeStats = { images: 0, pages: 0, elapsed: 0 };
    this._progressiveMediaData = [];
    this._progressiveLimit = 0;
    this._totalPages = 0;
    this.showAnalysisToggle = true;

    this.storageManager = null;
    this.contentParser = null;
    this._processedData = null;

    this._filteredDataCache = null;
    this._lastFilterParams = null;

    this._usageCountCache = null;
    this._lastUsageCountParams = null;

    this._readyPromise = null;
    this._isReady = false;
  }

  async connectedCallback() {
    super.connectedCallback();

    this._readyPromise = this._initialize();

    try {
      await this._readyPromise;
      this._isReady = true;

      this.dispatchEvent(new CustomEvent('media-library-ready', {
        detail: { mediaLibrary: this },
        bubbles: true,
      }));
    } catch (error) {
      this._error = `Initialization failed: ${error.message}`;
      this.dispatchEvent(new CustomEvent('media-library-error', {
        detail: { error },
        bubbles: true,
      }));
    }
  }

  async _initialize() {
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
      enableCategorization: true,
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

    await this.loadMediaDataFromStorage();
  }

  shouldUpdate(changedProperties) {
    return changedProperties.has('_mediaData')
           || changedProperties.has('_searchQuery')
           || changedProperties.has('_selectedFilterType')
           || changedProperties.has('_currentView')
           || changedProperties.has('_isScanning')
           || changedProperties.has('_scanProgress')
           || changedProperties.has('_error')
           || changedProperties.has('locale')
           || changedProperties.has('showAnalysisToggle')
           || changedProperties.has('_isBatchLoading')
           || changedProperties.has('_realTimeStats');
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
      await this.loadMediaDataFromStorage();
    } catch (error) {
      this._error = error.message;
    }
  }

  async loadMediaDataFromStorage(siteKey = null) {
    try {
      if (!this.storageManager) {
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

      this._filteredDataCache = null;
      this._lastFilterParams = null;
      this._usageCountCache = null;
      this._lastUsageCountParams = null;

      this.updateAnalysisToggleVisibility();
      this.requestUpdate();
    } catch (error) {
      this._mediaData = [];
      this._processedData = processMediaData([]);
      if (error.name !== 'NotFoundError' && !error.message.includes('object store')) {
        this._error = this.t('errors.loadFailed');
      }

      this.updateAnalysisToggleVisibility();
      this.requestUpdate();
    }
  }

  async loadFromPageList(pageList, onProgress = null, siteKey = null, saveToStorage = true) {
    if (!pageList || pageList.length === 0) {
      this._error = 'No pages provided to scan';
      return [];
    }

    try {
      this._isScanning = true;
      this._isBatchLoading = true;
      this._error = null;
      this._mediaData = [];
      this._progressiveMediaData = [];
      this._processedData = null;
      this._searchQuery = '';
      this._selectedFilterType = 'all';
      this._scanStartTime = Date.now();
      this._scanProgress = { current: 0, total: 0, found: 0 };
      this._lastScanDuration = null;
      this._scanStats = null;
      this._realTimeStats = { images: 0, pages: 0, elapsed: 0 };
      this._progressiveLimit = this.getProgressiveLimit();

      window.dispatchEvent(new CustomEvent('clear-search'));
      window.dispatchEvent(new CustomEvent('clear-filters'));

      const storageKey = siteKey || 'media-data';

      this._scanProgress = { current: 0, total: pageList.length, found: 0 };
      this._totalPages = pageList.length;
      this.requestUpdate();

      const elapsedInterval = setInterval(() => {
        this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);
        this._realTimeStats = { ...this._realTimeStats };
        this.requestUpdate();
      }, 100);

      const allMediaData = [];

      for (let i = 0; i < pageList.length; i += 1) {
        const url = pageList[i];

        try {
          this._realTimeStats.pages = i + 1;
          this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);
          this.requestUpdate();

          this._realTimeStats = { ...this._realTimeStats };

          const mediaItems = await this.contentParser.scanPage(url);
          allMediaData.push(...mediaItems);

          this._realTimeStats.images += mediaItems.length;
          this._realTimeStats.pages = i + 1;
          this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);

          this._realTimeStats = { ...this._realTimeStats };

          this._mediaData = allMediaData;
          this._progressiveMediaData = [...allMediaData];

          this.requestUpdate();

          if (onProgress) {
            onProgress(i + 1, pageList.length, mediaItems.length);
          }
        } catch (error) {
          this._realTimeStats.pages = i + 1;
          this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);
          this.requestUpdate();

          if (onProgress) {
            onProgress(i + 1, pageList.length, 0);
          }
        }
      }

      clearInterval(elapsedInterval);
      const mediaData = allMediaData;

      const scanDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (scanDuration / 1000).toFixed(1);

      if (saveToStorage) {
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
      }

      this._mediaData = mediaData;
      this._processedData = processMediaData(mediaData);
      this._isScanning = false;
      this._isBatchLoading = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;

      this.updateAnalysisToggleVisibility();

      this._filteredDataCache = null;
      this._lastFilterParams = null;
      this._usageCountCache = null;
      this._lastUsageCountParams = null;

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
      this._isBatchLoading = false;
      this._scanProgress = null;
      this._error = `Scan failed: ${error.message}`;
      this.updateAnalysisToggleVisibility();
      throw error;
    }
  }

  async loadFromStorage(siteKey) {
    const originalStorageType = this.storageManager.type;
    this.storageManager.type = 'indexeddb';

    try {
      await this.loadMediaDataFromStorage(siteKey);
      return this._mediaData;
    } finally {
      this.storageManager.type = originalStorageType;
    }
  }

  async loadMediaData(mediaData, siteKey = null, saveToStorage = false) {
    if (!mediaData || !Array.isArray(mediaData)) {
      this._error = 'No media data provided';
      return [];
    }

    try {
      this._isScanning = true;
      this._error = null;
      this._searchQuery = '';
      this._selectedFilterType = 'all';
      this._scanStartTime = Date.now();
      this._scanProgress = { current: 0, total: 1, found: mediaData.length };
      this._lastScanDuration = null;
      this._scanStats = null;

      window.dispatchEvent(new CustomEvent('clear-search'));
      window.dispatchEvent(new CustomEvent('clear-filters'));

      this.requestUpdate();

      this._mediaData = mediaData;
      this._processedData = processMediaData(mediaData);

      const loadDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (loadDuration / 1000).toFixed(1);

      if (saveToStorage && siteKey) {
        await this.storageManager.save(mediaData, siteKey);
        await this.storageManager.saveScanMetadata(siteKey, {
          totalPages: 0,
          pageLastModified: {},
          scanDuration: loadDuration,
          source: 'direct-load',
        });
      }

      this._isScanning = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;

      this.updateAnalysisToggleVisibility();

      this._filteredDataCache = null;
      this._lastFilterParams = null;
      this._usageCountCache = null;
      this._lastUsageCountParams = null;

      this._scanStats = {
        pagesScanned: 0,
        mediaFound: mediaData.length,
        duration: durationSeconds,
        source: 'direct-load',
      };

      if (typeof window.refreshSites === 'function') {
        window.refreshSites();
      }

      return mediaData;
    } catch (error) {
      this._isScanning = false;
      this._scanProgress = null;
      this._error = `Load failed: ${error.message}`;
      this.updateAnalysisToggleVisibility();
      throw error;
    }
  }

  clearData() {
    this._mediaData = [];
    this._processedData = processMediaData([]);
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._scanStats = null;
    this._lastScanDuration = null;
    this.updateAnalysisToggleVisibility();
    this.requestUpdate();
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

  updateAnalysisToggleVisibility() {
    const shouldShow = this._mediaData.length === 0 || this._isScanning;

    if (this.showAnalysisToggle !== shouldShow) {
      this.showAnalysisToggle = shouldShow;
    }
  }

  get filteredMediaData() {
    const currentParams = {
      filterType: this._selectedFilterType,
      searchQuery: this._searchQuery,
      selectedDocument: this.selectedDocument,
      dataLength: this._mediaData?.length || 0,
    };

    if (this._filteredDataCache
        && this._lastFilterParams
        && JSON.stringify(this._lastFilterParams) === JSON.stringify(currentParams)) {
      return this._filteredDataCache;
    }

    const filteredData = calculateFilteredMediaData(
      this._mediaData,
      this._selectedFilterType,
      this._searchQuery,
      this.selectedDocument,
    );

    this._filteredDataCache = filteredData;
    this._lastFilterParams = currentParams;

    return filteredData;
  }

  addUsageCountToMedia(mediaData) {
    if (!mediaData) return [];

    const currentParams = {
      dataLength: mediaData.length,
      firstUrl: mediaData[0]?.url || '',
      lastUrl: mediaData[mediaData.length - 1]?.url || '',
    };

    if (this._usageCountCache
        && this._lastUsageCountParams
        && JSON.stringify(this._lastUsageCountParams) === JSON.stringify(currentParams)) {
      return this._usageCountCache;
    }

    const usageCounts = {};
    const urlGroups = {};

    mediaData.forEach((item) => {
      if (item.url) {
        let groupKey = null;

        for (const existingKey of Object.keys(urlGroups)) {
          if (urlsMatch(item.url, existingKey)) {
            groupKey = existingKey;
            break;
          }
        }

        if (!groupKey) {
          groupKey = item.url;
          urlGroups[groupKey] = [];
        }

        urlGroups[groupKey].push(item);
        usageCounts[groupKey] = (usageCounts[groupKey] || 0) + 1;
      }
    });

    const uniqueMedia = {};
    Object.keys(urlGroups).forEach((groupKey) => {
      const group = urlGroups[groupKey];
      const firstItem = group[0];

      uniqueMedia[groupKey] = {
        ...firstItem,
        usageCount: usageCounts[groupKey] || 1,
      };
    });

    const result = Object.values(uniqueMedia);

    this._usageCountCache = result;
    this._lastUsageCountParams = currentParams;

    return result;
  }

  getProgressiveLimit() {
    return this._currentView === 'grid' ? 500 : 750;
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

  get isUIdisabled() {
    return this._isScanning || !this._mediaData || this._mediaData.length === 0;
  }

  handleSearch(e) {
    if (this.isUIdisabled) return;
    this._searchQuery = e.detail.query;
  }

  handleViewChange(e) {
    if (this.isUIdisabled) return;
    this._currentView = e.detail.view;
  }

  handleFilter(e) {
    if (this.isUIdisabled) return;
    this._selectedFilterType = e.detail.type;
  }

  async handleMediaClick(e) {
    const { media } = e.detail;
    if (!media) return;

    const filteredItems = this._mediaData?.filter((item) => urlsMatch(item.url, media.url)) || [];
    const usageData = filteredItems.map((item) => ({
      doc: item.doc || 'Unknown Document',
      alt: item.alt,
      type: item.type,
      ctx: item.ctx,
      firstUsedAt: item.firstUsedAt,
      lastUsedAt: item.lastUsedAt,
    }));

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
            .isScanning=${this.isUIdisabled}
            .scanProgress=${this._scanProgress}
            .isActuallyScanning=${this._isScanning}
            .isBatchLoading=${this._isBatchLoading}
            .realTimeStats=${this._realTimeStats}
            .lastScanDuration=${this._lastScanDuration}
            .scanStats=${this._scanStats}
            .imageAnalysisEnabled=${this._imageAnalysisEnabled}
            .showAnalysisToggle=${this.showAnalysisToggle}
            .mediaData=${this._mediaData}
            .totalPages=${this._totalPages}
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
            .isScanning=${this.isUIdisabled}
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

  get ready() {
    return this._readyPromise || Promise.resolve(this);
  }

  get isReady() {
    return this._isReady;
  }

  static async create(options = {}) {
    const element = document.createElement('media-library');

    if (options.storage) element.storage = options.storage;
    if (options.locale) element.locale = options.locale;

    document.body.appendChild(element);

    await element.ready;

    return element;
  }

  static waitForReady = waitForMediaLibraryReady;

  static createInstance = createMediaLibrary;

  static initialize = initializeMediaLibrary;

  renderCurrentView() {
    if (this._isScanning) {
      if (this._progressiveMediaData.length > 0) {
        return html`
          <media-scan-view
            .mediaData=${this._progressiveMediaData}
            .locale=${this.locale}
          ></media-scan-view>
        `;
      }

      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <h3>Discovering Media</h3>
          <p>Scanning pages and extracting media files...</p>
        </div>
      `;
    }

    const mediaWithUsageCount = this.addUsageCountToMedia(this.filteredMediaData);

    return this._currentView === 'list'
      ? html`
          <media-list
            .mediaData=${mediaWithUsageCount}
            .searchQuery=${this._searchQuery}
            .locale=${this.locale}
            @mediaClick=${this.handleMediaClick}
            @mediaAction=${this.handleMediaAction}
          ></media-list>
        `
      : html`
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
