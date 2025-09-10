// src/components/topbar/topbar.js
import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import getSvg from '../../utils/get-svg.js';
import { getStyles } from '../../utils/get-styles.js';
import { generateSearchSuggestions, createSearchSuggestion } from '../../utils/filters.js';
import topbarStyles from './topbar.css?inline';

class MediaTopbar extends LocalizableElement {
  static properties = {
    searchQuery: { type: String },
    currentView: { type: String },
    locale: { type: String },
    isScanning: { type: Boolean },
    scanProgress: { type: Object },
    lastScanDuration: { type: String },
    scanStats: { type: Object },
    imageAnalysisEnabled: { type: Boolean },
    mediaData: { type: Array },
    _suggestions: { state: true },
    _activeIndex: { state: true },
    _originalQuery: { state: true },
    _suppressSuggestions: { state: true },
  };

  static styles = getStyles(topbarStyles);

  constructor() {
    super();
    this.searchQuery = '';
    this.currentView = 'grid';
    this.locale = 'en';
    this.isScanning = false;
    this.scanProgress = null;
    this.lastScanDuration = null;
    this.scanStats = null;
    this.imageAnalysisEnabled = true;
    this.mediaData = [];
    this._suggestions = [];
    this._activeIndex = -1;
    this._originalQuery = '';
    this._suppressSuggestions = false;
  }

  async connectedCallback() {
    super.connectedCallback();

    const ICONS = [
      '/src/icons/search.svg',
      '/src/icons/close.svg',
      '/src/icons/list.svg',
      '/src/icons/grid.svg',
      '/src/icons/refresh.svg',
      '/src/icons/photo.svg',
    ];

    getSvg({ parent: this.shadowRoot, paths: ICONS });

    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleClearSearch = this.handleClearSearch.bind(this);
    document.addEventListener('click', this.handleOutsideClick);
    window.addEventListener('clear-search', this.handleClearSearch);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('clear-search', this.handleClearSearch);
  }

  handleOutsideClick(e) {
    const searchContainer = this.shadowRoot.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(e.target)) {
      this._suggestions = [];
      this._activeIndex = -1;
      this._suppressSuggestions = true;
    }
  }

  handleClearSearch() {
    this.searchQuery = '';
    this._suggestions = [];
    this._activeIndex = -1;
    this._suppressSuggestions = false;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="topbar">
        <div class="search-container">
          <div class="search-wrapper">
            <svg class="search-icon">
              <use href="#search"></use>
            </svg>
            <input 
              class="search-input"
              type="text"
              placeholder=${this.t('mediaLibrary.searchPlaceholder')}
              .value=${this.searchQuery || ''}
              @input=${this.handleSearchInput}
              @keydown=${this.handleKeyDown}
            />
            ${this.searchQuery ? html`
              <button 
                class="clear-button"
                @click=${this.clearSearch}
                aria-label=${this.t('common.clear')}
              >
                <svg class="clear-icon">
                  <use href="#close"></use>
                </svg>
              </button>
            ` : ''}
          </div>
          ${this._suggestions.length ? html`
            <div class="suggestions-dropdown">
              ${this._suggestions.map((suggestion, index) => html`
                <div 
                  class="suggestion-item ${index === this._activeIndex ? 'active' : ''}"
                  @click=${() => this.selectSuggestion(suggestion)}
                >
                  <div class="suggestion-main">
                    <span class="suggestion-text" .innerHTML=${this.highlightMatch(suggestion.display, this._originalQuery)}></span>
                  </div>
                  ${suggestion.details ? html`
                    <div class="suggestion-details">
                      ${suggestion.details.alt ? html`<div class="detail-line">Alt: <span .innerHTML=${this.highlightMatch(suggestion.details.alt, this._originalQuery)}></span></div>` : ''}
                      ${suggestion.details.doc ? html`<div class="detail-line">Doc: <span .innerHTML=${this.highlightMatch(suggestion.details.doc, this._originalQuery)}></span></div>` : ''}
                    </div>
                  ` : ''}
                </div>
              `)}
            </div>
          ` : ''}
        </div>

        ${this.scanStats ? html`
          <div class="scan-stats">
            <div class="stat-item">
              <span class="stat-label">Pages:</span>
              <span class="stat-value">${this.scanStats.pagesScanned}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Media:</span>
              <span class="stat-value">${this.scanStats.mediaFound}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Time:</span>
              <span class="stat-value">${this.scanStats.duration}s</span>
            </div>
          </div>
        ` : ''}

        <button 
          class="view-toggle-button"
          @click=${this.toggleView}
          aria-label=${this.currentView === 'grid' ? this.t('views.list') : this.t('views.grid')}
          title=${this.currentView === 'grid' ? this.t('views.list') : this.t('views.grid')}
        >
          <svg class="view-icon">
            <use href="#${this.currentView === 'grid' ? 'list' : 'grid'}"></use>
          </svg>
        </button>

        <div class="scan-container">
          <button 
            class="scan-button"
            @click=${this.handleScan}
            ?disabled=${this.isScanning}
          >
            <svg class="scan-icon">
              <use href="#refresh"></use>
            </svg>
            ${this.isScanning ? this.t('mediaLibrary.scanning') : this.t('mediaLibrary.scanButton')}
          </button>
          
          <div class="analysis-toggle-container">
            <label class="analysis-toggle-label">
              <input 
                type="checkbox" 
                class="analysis-toggle-input"
                ?checked=${this.imageAnalysisEnabled}
                @change=${this.toggleImageAnalysis}
                ?disabled=${this.isScanning}
              />
              <span class="analysis-toggle-slider ${this.imageAnalysisEnabled ? 'enabled' : ''}"></span>
            </label>
          </div>
          
          ${this.lastScanDuration ? html`
            <div class="scan-duration">
              Last scan: ${this.lastScanDuration}s
            </div>
          ` : ''}
        </div>
      </div>

      ${this.scanProgress ? html`
        <div class="scan-progress">
          ${this.scanProgress.current === 0
    ? this.t('mediaLibrary.scanStarting')
    : this.t('mediaLibrary.scanProgress', {
      current: this.scanProgress.current || 0,
      total: this.scanProgress.total || 0,
    })
}
        </div>
      ` : ''}
    `;
  }

  getOnDemandSearchSuggestions(query) {
    return generateSearchSuggestions(this.mediaData, query, createSearchSuggestion);
  }

  handleSearchInput(e) {
    const query = e.target.value;
    this.searchQuery = query;
    this._originalQuery = query;
    this._activeIndex = -1;

    if (!query || !query.trim() || this._suppressSuggestions) {
      this._suggestions = [];
      this._suppressSuggestions = false;
    } else {
      this._suggestions = this.getOnDemandSearchSuggestions(query);
    }

    this.dispatchEvent(new CustomEvent('search', { detail: { query } }));
  }

  handleKeyDown(e) {
    if (!this._suggestions.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (this._activeIndex === -1) {
          this._originalQuery = this.searchQuery;
        }
        this._activeIndex = (this._activeIndex + 1) % this._suggestions.length;
        this.searchQuery = this.getSuggestionText(this._suggestions[this._activeIndex]);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this._activeIndex === -1) {
          this._originalQuery = this.searchQuery;
        }
        this._activeIndex = (this._activeIndex - 1 + this._suggestions.length)
          % this._suggestions.length;
        this.searchQuery = this.getSuggestionText(this._suggestions[this._activeIndex]);
        break;

      case 'Enter':
        e.preventDefault();
        if (this._activeIndex >= 0) {
          this.selectSuggestion(this._suggestions[this._activeIndex]);
        } else {
          if (this.searchQuery === '/') {
            this.searchQuery = 'folder:/';
            this._suggestions = [];
            this._activeIndex = -1;
            this._suppressSuggestions = true;
            this.dispatchEvent(new CustomEvent('search', {
              detail: {
                query: this.searchQuery,
                type: 'folder',
                path: '',
              },
            }));
            return;
          }
          this._suggestions = [];
          this._activeIndex = -1;
          this._suppressSuggestions = true;
          this.dispatchEvent(new CustomEvent('search', { detail: { query: this.searchQuery } }));
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.searchQuery = this._originalQuery;
        this._suggestions = [];
        this._activeIndex = -1;
        this._suppressSuggestions = true;
        break;

      default:
        break;
    }
  }

  getSuggestionText(suggestion) {
    if (suggestion.type === 'doc') return `doc:${suggestion.value}`;
    if (suggestion.type === 'folder') {
      return suggestion.value === '' ? 'folder:/' : `folder:${suggestion.value}`;
    }
    if (suggestion.type === 'media') {
      return suggestion.value.name || suggestion.value.url;
    }
    return '';
  }

  selectSuggestion(suggestion) {
    this._suggestions = [];
    this._activeIndex = -1;
    this._suppressSuggestions = true;

    if (suggestion.type === 'doc') {
      this.searchQuery = `doc:${suggestion.value}`;
      this.dispatchEvent(new CustomEvent('search', {
        detail: {
          query: this.searchQuery,
          type: 'doc',
          path: suggestion.value,
        },
      }));
    } else if (suggestion.type === 'folder') {
      this.searchQuery = suggestion.value === '' ? 'folder:/' : `folder:${suggestion.value}`;
      this.dispatchEvent(new CustomEvent('search', {
        detail: {
          query: this.searchQuery,
          type: 'folder',
          path: suggestion.value,
        },
      }));
    } else {
      this.searchQuery = suggestion.value.name;
      this.dispatchEvent(new CustomEvent('search', {
        detail: {
          query: this.searchQuery,
          type: 'media',
          media: suggestion.value,
        },
      }));
    }
  }

  highlightMatch(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'ig');
    return text.replace(regex, '<mark>$1</mark>');
  }

  clearSearch() {
    this.searchQuery = '';
    this._suggestions = [];
    this._activeIndex = -1;
    this._originalQuery = '';
    this._suppressSuggestions = false;
    this.dispatchEvent(new CustomEvent('search', { detail: { query: '' } }));
  }

  handleViewChange(view) {
    this.dispatchEvent(new CustomEvent('viewChange', { detail: { view } }));
  }

  toggleView() {
    const newView = this.currentView === 'grid' ? 'list' : 'grid';
    this.handleViewChange(newView);
  }

  handleScan() {
    this.dispatchEvent(new CustomEvent('scan', { detail: {} }));
  }

  toggleImageAnalysis(event) {
    this.imageAnalysisEnabled = event.target.checked;
    this.dispatchEvent(new CustomEvent('toggleImageAnalysis', { detail: { enabled: this.imageAnalysisEnabled } }));
  }
}

customElements.define('media-topbar', MediaTopbar);
