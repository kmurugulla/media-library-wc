import { html, LitElement } from 'lit';
import { ref, createRef } from 'lit/directives/ref.js';
import getSvg from '../../utils/get-svg.js';
import { getStyles } from '../../utils/get-styles.js';
import { generateSearchSuggestions, createSearchSuggestion } from '../../utils/filters.js';
import topbarStyles from './topbar.css?inline';

class MediaTopbar extends LitElement {
  static properties = {
    searchQuery: { type: String },
    mediaData: { type: Array },
    resultSummary: { type: String },
    _suggestions: { state: true },
    _activeIndex: { state: true },
    _originalQuery: { state: true },
    _suppressSuggestions: { state: true },
  };

  static styles = getStyles(topbarStyles);

  constructor() {
    super();
    this.searchQuery = '';
    this.mediaData = [];
    this.resultSummary = '';
    this._suggestions = [];
    this._activeIndex = -1;
    this._originalQuery = '';
    this._suppressSuggestions = false;

    this._searchDebounceTimeout = null;
    this._suggestionDebounceTimeout = null;
    this._lastSearchQuery = '';

    this.searchContainerRef = createRef();
  }

  async connectedCallback() {
    super.connectedCallback();

    const ICONS = [
      'deps/icons/search.svg',
      'deps/icons/close.svg',
      'deps/icons/refresh.svg',
      'deps/icons/photo.svg',
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

    if (this._searchDebounceTimeout) {
      clearTimeout(this._searchDebounceTimeout);
    }
    if (this._suggestionDebounceTimeout) {
      clearTimeout(this._suggestionDebounceTimeout);
    }
  }

  handleOutsideClick(e) {
    const searchContainer = this.searchContainerRef.value;
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
        <div class="search-container" ${ref(this.searchContainerRef)}>
          <div class="search-wrapper">
            <svg class="search-icon">
              <use href="#search"></use>
            </svg>
            <input 
              class="search-input"
              type="text"
              placeholder="Search"
              .value=${this.searchQuery || ''}
              @input=${this.handleSearchInput}
              @keydown=${this.handleKeyDown}
            />
            ${this.searchQuery ? html`
              <button 
                class="clear-button"
                @click=${this.clearSearch}
                aria-label="Clear"
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

        ${this.resultSummary ? html`
          <div class="result-summary">
            ${this.resultSummary}
          </div>
        ` : ''}
      </div>
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

    if (this._searchDebounceTimeout) {
      clearTimeout(this._searchDebounceTimeout);
    }
    if (this._suggestionDebounceTimeout) {
      clearTimeout(this._suggestionDebounceTimeout);
    }

    this._searchDebounceTimeout = setTimeout(() => {
      this._lastSearchQuery = query;
      this.dispatchEvent(new CustomEvent('search', { detail: { query } }));
    }, 300);

    if (!query || !query.trim() || this._suppressSuggestions) {
      this._suggestions = [];
      this._suppressSuggestions = false;
    } else {
      this._suggestionDebounceTimeout = setTimeout(() => {
        this._suggestions = this.getOnDemandSearchSuggestions(query);
        this.requestUpdate();
      }, 200);
    }
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
}

customElements.define('media-topbar', MediaTopbar);
