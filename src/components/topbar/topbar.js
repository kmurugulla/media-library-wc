// src/components/topbar/topbar.js
import { html } from 'lit';
import { LocalizableElement } from '../base-localizable.js';
import getSvg from '../../utils/getSvg.js';
import { getStyles } from '../../utils/get-styles.js';
import topbarStyles from './topbar.css?inline';

class MediaTopbar extends LocalizableElement {
  static properties = {
    searchQuery: { type: String },
    currentView: { type: String },
    locale: { type: String },
    isScanning: { type: Boolean },
    scanProgress: { type: Object }
  };

  static styles = getStyles(topbarStyles);


  constructor() {
    super();
    this.searchQuery = '';
    this.currentView = 'grid';
    this.locale = 'en';
    this.isScanning = false;
    this.scanProgress = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    
    // Load SVG icons using Franklin approach
    const ICONS = [
      '/src/icons/search.svg',
      '/src/icons/close.svg',
      '/src/icons/list.svg',
      '/src/icons/grid.svg',
      '/src/icons/refresh.svg'
    ];
    
    getSvg({ parent: this.shadowRoot, paths: ICONS });
  }

  render() {
    return html`
      <div class="topbar">
        <div class="search-container">
          <svg class="search-icon">
            <use href="#search"></use>
          </svg>
          <input 
            class="search-input"
            type="text"
            placeholder=${this.t('mediaLibrary.searchPlaceholder')}
            .value=${this.searchQuery || ''}
            @input=${this.handleSearchInput}
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
      </div>

      ${this.scanProgress ? html`
        <div class="scan-progress">
          ${this.t('mediaLibrary.scanProgress', { count: this.scanProgress.pages || 0 })}
        </div>
      ` : ''}
    `;
  }

  handleSearchInput(e) {
    this.dispatchEvent(new CustomEvent('search', { 
      detail: { query: e.target.value } 
    }));
  }

  clearSearch() {
    this.dispatchEvent(new CustomEvent('search', { 
      detail: { query: '' } 
    }));
  }

  handleViewChange(view) {
    this.dispatchEvent(new CustomEvent('viewChange', { 
      detail: { view } 
    }));
  }

  toggleView() {
    const newView = this.currentView === 'grid' ? 'list' : 'grid';
    this.handleViewChange(newView);
  }

  handleScan() {
    this.dispatchEvent(new CustomEvent('scan', { 
      detail: {} 
    }));
  }
}

customElements.define('media-topbar', MediaTopbar);
