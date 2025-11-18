import { html, LitElement } from 'lit';
import { createStorage } from '../utils/storage.js';
import ContentParser from '../utils/parser.js';
import { processMediaData, calculateFilteredMediaData, calculateFilteredMediaDataFromIndex, getGroupingKey } from '../utils/filters.js';
import { copyMediaToClipboard, urlsMatch } from '../utils/utils.js';
import { getStyles } from '../utils/get-styles.js';
import './topbar/topbar.js';
import './sidebar/sidebar.js';
import './grid/grid.js';
import './media-details/media-details.js';
import getSvg from '../utils/get-svg.js';
import mediaLibraryStyles from './media-library.css?inline';

import { waitForMediaLibraryReady, createMediaLibrary, initializeMediaLibrary } from '../utils/initializer.js';

class MediaLibrary extends LitElement {
  static properties = {
    storage: { type: String },
    mode: { type: String },
    corsProxy: { type: String },
    _mediaData: { state: true },
    _error: { state: true },
    _searchQuery: { state: true },
    _selectedFilterType: { state: true },
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
    this.mode = 'live';
    this.corsProxy = 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/';
    this._mediaData = [];
    this._error = null;
    this._searchQuery = '';
    this._selectedFilterType = 'all';
    this._isScanning = false;
    this._scanProgress = null;
    this._imageAnalysisEnabled = false;
    this._isBatchLoading = false;
    this._realTimeStats = { images: 0, pages: 0, elapsed: 0 };
    this._progressiveMediaData = [];
    this._progressiveLimit = 0;
    this._progressiveGroupingKeys = new Set();
    this._totalPages = 0;
    this.showAnalysisToggle = true;

    this.storageManager = null;
    this.contentParser = null;
    this._processedData = null;

    this._filteredDataCache = null;
    this._filterCacheKey = null;

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
      'deps/icons/close.svg',
      'deps/icons/photo.svg',
      'deps/icons/video.svg',
      'deps/icons/pdf.svg',
      'deps/icons/external-link.svg',
      'deps/icons/copy.svg',
      'deps/icons/filter.svg',
      'deps/icons/document.svg',
      'deps/icons/all.svg',
    ];

    await getSvg({ parent: this.shadowRoot, paths: ICONS });

    this.storageManager = createStorage(this.storage);
    this.contentParser = new ContentParser({
      corsProxy: this.corsProxy,
      enableImageAnalysis: this._imageAnalysisEnabled,
      analysisConfig: {
        extractEXIF: true,
        extractDimensions: true,
      },
    });

    await this.loadMediaDataFromStorage();
  }

  shouldUpdate(changedProperties) {
    // Content/Data changes - require full re-render
    const hasDataChange = changedProperties.has('_mediaData');
    
    // Filter/Search changes - require filtered view update
    const hasFilterChange = changedProperties.has('_searchQuery')
                         || changedProperties.has('_selectedFilterType');
    
    // UI state changes - require UI updates
    const hasUIChange = changedProperties.has('_isScanning')
                     || changedProperties.has('_scanProgress')
                     || changedProperties.has('_error')
                     || changedProperties.has('showAnalysisToggle')
                     || changedProperties.has('_isBatchLoading')
                     || changedProperties.has('_realTimeStats');
    
    // Configuration changes - require component reconfiguration
    const hasConfigChange = changedProperties.has('corsProxy');

    return hasDataChange || hasFilterChange || hasUIChange || hasConfigChange;
  }

  async updated(changedProperties) {
    if (changedProperties.has('corsProxy')) {
      // Update the ContentParser with the new CORS proxy
      if (this.contentParser) {
        this.contentParser.corsProxy = this.corsProxy;
      }
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

      this._isBatchLoading = true;
      this.requestUpdate();

      const key = siteKey || 'media-data';
      const data = await this.storageManager.load(key);

      if (data && data.length > 0) {
        this._mediaData = data;
        this._processedData = await processMediaData(data);
      } else {
        this._mediaData = [];
        this._processedData = await processMediaData([]);
      }

      // Reset scanning state to prevent progressive loading from interfering
      this._isScanning = false;
      this._isBatchLoading = false;
      this._progressiveMediaData = [];

      this._filteredDataCache = null;

      this.updateAnalysisToggleVisibility();
      this.requestUpdate();
    } catch (error) {
      this._mediaData = [];
      this._processedData = await processMediaData([]);

      // Reset scanning state to prevent progressive loading from interfering
      this._isScanning = false;
      this._isBatchLoading = false;
      this._progressiveMediaData = [];

      if (error.name !== 'NotFoundError' && !error.message.includes('object store')) {
        this._error = 'Failed to load media data';
      }

      this.updateAnalysisToggleVisibility();
      this.requestUpdate();
    }
  }

  async loadFromPageList(
    pageList,
    onProgress = null,
    siteKey = null,
    saveToStorage = true,
    previousMetadata = null,
    completePageList = null,
    existingMediaData = null,
  ) {
    if (!pageList || pageList.length === 0) {
      this._error = 'No pages provided to scan';
      return [];
    }

    try {
      this._isScanning = true;
      this._isBatchLoading = true;
      this._error = null;
      this._progressiveMediaData = [];
      this._progressiveGroupingKeys = new Set();
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

      let currentExistingMediaData = existingMediaData || this._mediaData || [];

      if (previousMetadata && currentExistingMediaData.length === 0) {
        currentExistingMediaData = await this.storageManager.load() || [];
      }

      // Initialize progressive media data with existing media for incremental scans
      if (currentExistingMediaData.length > 0) {
        this._progressiveMediaData = [...currentExistingMediaData];
        // Initialize grouping keys for existing media
        currentExistingMediaData.forEach((item) => {
          if (item.url) {
            this._progressiveGroupingKeys.add(getGroupingKey(item.url));
          }
        });
      }

      this._scanProgress = { current: 0, total: pageList.length, found: 0 };
      this._totalPages = pageList.length;
      this.requestUpdate();

      const elapsedInterval = setInterval(() => {
        this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);
        this._realTimeStats = { ...this._realTimeStats };
        this.requestUpdate();
      }, 100);

      const newMediaItems = await this.contentParser.scanPages(
        pageList,
        (completed, total, found) => {
          this._realTimeStats.pages = completed;
          this._realTimeStats.images += found;
          this._realTimeStats.elapsed = ((Date.now() - this._scanStartTime) / 1000).toFixed(1);
          this._realTimeStats = { ...this._realTimeStats };

          // Update progressive media data for real-time display
          if (found > 0) {
            const latestItems = this.contentParser.getLatestMediaItems();
            if (latestItems && latestItems.length > 0) {
              let hasUpdates = false;

              // Update usage counts for existing items
              latestItems.forEach((newItem) => {
                const groupingKey = getGroupingKey(newItem.url);
                const existingItem = this._progressiveMediaData.find((item) => {
                  const itemGroupingKey = getGroupingKey(item.url);
                  return itemGroupingKey === groupingKey;
                });
                if (existingItem) {
                  existingItem.usageCount = (existingItem.usageCount || 1) + 1;
                  hasUpdates = true;
                }
              });
              // Filter out items that already exist in progressive data using grouping keys
              const newUniqueItems = latestItems.filter((item) => {
                if (!item.url) return false;
                const groupingKey = getGroupingKey(item.url);
                if (!this._progressiveGroupingKeys.has(groupingKey)) {
                  this._progressiveGroupingKeys.add(groupingKey);
                  item.usageCount = 1;
                  return true;
                }
                return false;
              });

              if (newUniqueItems.length > 0 || hasUpdates) {
                // Add only new unique items to progressive data
                this._progressiveMediaData = [...this._progressiveMediaData, ...newUniqueItems];
              }
            }
          }

          this.requestUpdate();

          if (onProgress) {
            onProgress(completed, total, found);
          }
        },
        previousMetadata,
      );

      clearInterval(elapsedInterval);

      const scanDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (scanDuration / 1000).toFixed(1);

      let pagesToReparse = [];
      if (previousMetadata && previousMetadata.pageLastModified) {
        pagesToReparse = pageList.map((page) => page.loc || page.url);
      }

      const filteredExistingMedia = currentExistingMediaData.filter((item) => {
        const isNotInReparseList = !pagesToReparse.includes(item.doc);
        return isNotInReparseList;
      });

      const completeMediaData = [...filteredExistingMedia, ...newMediaItems];

      if (saveToStorage) {
        await this.storageManager.save(completeMediaData);
      }

      const metadataPageList = completePageList || pageList;
      const pageLastModified = {};
      metadataPageList.forEach((page) => {
        pageLastModified[page.loc || page.url] = page.lastmod;
      });

      await this.storageManager.saveScanMetadata({
        totalPages: metadataPageList.length,
        pageLastModified,
        scanDuration,
      });

      this._mediaData = completeMediaData;
      this._processedData = await processMediaData(completeMediaData);
      this._isScanning = false;
      this._isBatchLoading = false;
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;

      this.updateAnalysisToggleVisibility();

      this._filteredDataCache = null;

      this.requestUpdate();

      this._scanStats = {
        pagesScanned: pageList.length,
        mediaFound: newMediaItems.length,
        duration: durationSeconds,
      };

      if (typeof window.refreshSites === 'function') {
        window.refreshSites();
      }

      return completeMediaData;
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

  async loadMediaData(mediaData, siteKey = null, saveToStorage = false, metadata = null) {
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
      this._scanProgress = { current: 0, total: 0, found: mediaData.length };
      this._lastScanDuration = null;
      this._scanStats = null;

      window.dispatchEvent(new CustomEvent('clear-search'));
      window.dispatchEvent(new CustomEvent('clear-filters'));

      this.requestUpdate();

      this._mediaData = mediaData;
      this._processedData = await processMediaData(mediaData);

      const loadDuration = Date.now() - this._scanStartTime;
      const durationSeconds = (loadDuration / 1000).toFixed(1);

      // Use provided metadata or load from storage
      const existingMetadata = metadata || await this.storageManager.loadScanMetadata();
      const totalPages = existingMetadata ? existingMetadata.totalPages : 0;

      if (saveToStorage && siteKey) {
        await this.storageManager.save(mediaData);
        await this.storageManager.saveScanMetadata({
          totalPages: 0,
          pageLastModified: {},
          scanDuration: loadDuration,
          source: 'direct-load',
        });
      }

      // Set scanning to false and update the UI
      this._isScanning = false;
      this._isBatchLoading = false;
      this._progressiveMediaData = []; // Clear progressive data
      this._scanProgress = null;
      this._lastScanDuration = durationSeconds;
      this._totalPages = totalPages;

      this.updateAnalysisToggleVisibility();

      this._filteredDataCache = null;

      this.requestUpdate();

      this._scanStats = {
        pagesScanned: totalPages,
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

  async clearData() {
    this._mediaData = [];
    this._processedData = await processMediaData([]);
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
    // Create efficient cache key
    const cacheKey = `${this._selectedFilterType}|${this._searchQuery || ''}|${this.selectedDocument || ''}|${this._mediaData?.length || 0}`;

    // Return cached data if parameters haven't changed
    if (this._filteredDataCache && this._filterCacheKey === cacheKey) {
      return this._filteredDataCache;
    }

    // Check if we have processed data for indexed filtering
    if (!this._processedData) {
      const filteredData = calculateFilteredMediaData(
        this._mediaData,
        this._selectedFilterType,
        this._searchQuery,
        this.selectedDocument,
      );

      // Deduplicate by URL - keep only one instance per unique URL
      const deduplicatedData = [];
      const seenUrls = new Set();

      filteredData.forEach((item) => {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          deduplicatedData.push(item);
        }
      });

      this._filteredDataCache = deduplicatedData;
      this._filterCacheKey = cacheKey;
      return deduplicatedData;
    }

    const filteredData = calculateFilteredMediaDataFromIndex(
      this._mediaData,
      this._processedData,
      this._selectedFilterType,
      this._searchQuery,
      this.selectedDocument,
    );

    // Deduplicate by URL - keep only one instance per unique URL
    const deduplicatedData = [];
    const seenUrls = new Set();

    filteredData.forEach((item) => {
      if (item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        deduplicatedData.push(item);
      }
    });

    this._filteredDataCache = deduplicatedData;
    this._filterCacheKey = cacheKey;

    return deduplicatedData;
  }

  // REMOVED: addUsageCountToMediaFromProcessedData function
  // Usage counts are now calculated during initial processing in processMediaData()
  // This eliminates the 7+ second delay on every filter change

  getProgressiveLimit() {
    return 500;
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
    const counts = this._processedData?.filterCounts || {};
    return counts;
  }

  get isUIdisabled() {
    return this._isScanning || !this._mediaData || this._mediaData.length === 0;
  }

  getResultSummary() {
    if (this._isScanning) {
      return '';
    }
    const filteredCount = this.filteredMediaData?.length || 0;
    const totalCount = this._mediaData?.length || 0;

    if (this._searchQuery || this._selectedFilterType !== 'all') {
      return `${filteredCount} of ${totalCount} References`;
    }
    return `${totalCount} References`;
  }

  getScanProgress() {
    if (this._isScanning) {
      return {
        pages: this._realTimeStats.pages || 0,
        media: this._realTimeStats.images || 0,
        duration: null,
        hasChanges: null,
      };
    }

    if (this._scanProgress || this._lastScanDuration) {
      const mediaCount = this._mediaData?.length || 0;
      return {
        pages: this._totalPages || 0,
        media: mediaCount,
        duration: this._lastScanDuration,
        hasChanges: true,
      };
    }

    return { pages: 0, media: 0, duration: null, hasChanges: null };
  }

  handleSearch(e) {
    if (this.isUIdisabled) return;
    this._searchQuery = e.detail.query;
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
      this.showNotification('Error', 'Failed to save changes', 'error');
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
            .mediaData=${this._mediaData}
            .resultSummary=${this.getResultSummary()}
            @search=${this.handleSearch}
          ></media-topbar>
        </div>


        <div class="sidebar">
          <media-sidebar
            .activeFilter=${this._selectedFilterType}
            .filterCounts=${this.filterCounts}
            .isScanning=${this._isScanning}
            .scanProgress=${this.getScanProgress()}
            @filter=${this.handleFilter}
          ></media-sidebar>
        </div>

        <div class="main-content">
          ${this._error ? this.renderErrorState() : this.renderCurrentView()}
        </div>

        <media-details 
          .isScanning=${this._isScanning}>
        </media-details>
      </div>
    `;
  }

  renderErrorState() {
    return html`
      <div class="error-state">
        <svg class="error-icon">
          <use href="#close"></use>
        </svg>
        <h3>Error</h3>
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
          <media-grid
            .mediaData=${this._progressiveMediaData}
            .searchQuery=${this._searchQuery}
            .isProcessing=${true}
            @mediaClick=${this.handleMediaClick}
            @mediaAction=${this.handleMediaAction}
          ></media-grid>
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

    if (this._isBatchLoading) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <h3>Loading Media</h3>
          <p>Loading media data from storage...</p>
        </div>
      `;
    }

    const mediaWithUsageCount = this.filteredMediaData;

    return html`
      <media-grid
        .mediaData=${mediaWithUsageCount}
        .searchQuery=${this._searchQuery}
        .isProcessing=${false}
        @mediaClick=${this.handleMediaClick}
        @mediaAction=${this.handleMediaAction}
      ></media-grid>
    `;
  }
}

customElements.define('media-library', MediaLibrary);

export default MediaLibrary;
