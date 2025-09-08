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
    scanProgress: { type: Object },
    lastScanDuration: { type: String },
    scanStats: { type: Object },
    imageAnalysisEnabled: { type: Boolean }
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
    this.imageAnalysisEnabled = true; // Default to ON
  }

  async connectedCallback() {
    super.connectedCallback();
    
    const ICONS = [
      '/src/icons/search.svg',
      '/src/icons/close.svg',
      '/src/icons/list.svg',
      '/src/icons/grid.svg',
      '/src/icons/refresh.svg',
      '/src/icons/photo.svg'
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
          ${this.scanProgress.current === 0 ? 
            this.t('mediaLibrary.scanStarting') :
            this.t('mediaLibrary.scanProgress', { 
              current: this.scanProgress.current || 0, 
              total: this.scanProgress.total || 0 
            })
          }
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

  toggleImageAnalysis(event) {
    this.imageAnalysisEnabled = event.target.checked;
    this.dispatchEvent(new CustomEvent('toggleImageAnalysis', { 
      detail: { enabled: this.imageAnalysisEnabled } 
    }));
  }
}

customElements.define('media-topbar', MediaTopbar);
