// src/components/grid/grid.js
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import LocalizableElement from '../base-localizable.js';
import { getMediaType, isImage } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import { GridVirtualScrollManager } from '../../utils/virtual-scroll.js';
import getSvg from '../../utils/getSvg.js';
import gridStyles from './grid.css?inline';

class MediaGrid extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    searchQuery: { type: String },
    locale: { type: String },
    visibleStart: { type: Number },
    visibleEnd: { type: Number },
    colCount: { type: Number },
  };

  static styles = getStyles(gridStyles);

  constructor() {
    super();
    this.mediaData = [];
    this.searchQuery = '';
    this.locale = 'en';

    this.visibleStart = 0;
    this.visibleEnd = 50;
    this.colCount = 4;

    this.virtualScroll = new GridVirtualScrollManager({
      onRangeChange: (range) => {
        this.visibleStart = range.start;
        this.visibleEnd = range.end;
        requestAnimationFrame(() => {
          this.requestUpdate();
        });
      },
      onColCountChange: (colCount) => {
        this.colCount = colCount;
        requestAnimationFrame(() => {
          this.requestUpdate();
        });
      },
    });
  }

  connectedCallback() {
    super.connectedCallback();
  }

  async firstUpdated() {
    this.setupScrollListener();
    window.addEventListener('resize', () => {
      this.virtualScroll.updateColCount();
    });
  }

  willUpdate(changedProperties) {
    if (changedProperties.has('mediaData')) {
      if (this.mediaData && this.mediaData.length > 0) {
        this.virtualScroll.resetState(this.mediaData.length);
      } else {
        this.visibleStart = 0;
        this.visibleEnd = 0;
      }
    }
  }

  updated(changedProperties) {
    // Load icons if they haven't been loaded yet
    this.loadIcons();

    if (changedProperties.has('mediaData')) {
      this.updateComplete.then(() => {
        if (this.mediaData && this.mediaData.length > 0) {
          if (!this.virtualScroll.scrollListenerAttached) {
            this.setupScrollListener();
          } else {
            this.virtualScroll.updateTotalItems(this.mediaData.length);
            this.virtualScroll.calculateVisibleRange();
            this.virtualScroll.onVisibleRangeChange();
          }
        }
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.virtualScroll.cleanup();
  }

  async loadIcons() {
    const ICONS = [
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/pdf.svg',
      '/src/icons/external-link.svg',
      '/src/icons/copy.svg',
    ];

    const existingIcons = this.shadowRoot.querySelectorAll('svg[id]');
    if (existingIcons.length === 0) {
      await getSvg({ parent: this.shadowRoot, paths: ICONS });
    }
  }

  setupScrollListener() {
    requestAnimationFrame(() => {
      const container = this.shadowRoot.querySelector('.media-main');
      if (container) {
        this.virtualScroll.init(container, this.mediaData?.length || 0);
        this.virtualScroll.updateColCount();
        this.virtualScroll.calculateVisibleRange();
        this.virtualScroll.onVisibleRangeChange();
      }
    });
  }

  render() {
    if (!this.mediaData || this.mediaData.length === 0) {
      return html`
        <div class="empty-state">
          <svg class="empty-icon">
            <use href="#photo"></use>
          </svg>
          <h3>${this.t('mediaLibrary.noResults')}</h3>
          <p>${this.t('mediaLibrary.loadingMedia')}</p>
        </div>
      `;
    }

    const totalHeight = this.virtualScroll.calculateTotalHeight(this.mediaData.length);
    const visibleItems = this.mediaData.slice(this.visibleStart, this.visibleEnd);

    return html`
      <main class="media-main">
        <div class="media-grid" style="height: ${totalHeight}px;">
          ${repeat(visibleItems, (media) => media.url, (media, i) => {
    const index = this.visibleStart + i;
    const position = this.virtualScroll.calculateItemPosition(index);

    return this.renderMediaCard(media, index, position);
  })}
        </div>
      </main>
    `;
  }

  renderMediaCard(media, index, position) {
    const mediaType = getMediaType(media);
    this.getMediaTypeIcon(mediaType);

    return html`
      <div 
        class="media-card" 
        data-index="${index}"
        style="position: absolute; top: ${position.top}px; left: ${position.left}px; width: ${this.virtualScroll.itemWidth - this.virtualScroll.cardSpacing}px; height: ${this.virtualScroll.itemHeight - this.virtualScroll.cardSpacing}px;"
        @click=${() => this.handleMediaClick(media)}
      >
        <div class="media-preview">
          ${this.renderMediaPreview(media, mediaType)}
          <div class="media-type-badge">
            <svg class="media-type-icon">
              <use href="#${this.getMediaTypeIcon(mediaType)}"></use>
            </svg>
          </div>
        </div>
        
        <div class="media-info">
          <div class="media-details">
            <h4 class="media-name" title=${media.name} .innerHTML=${this.highlightSearchTerm(this.truncateText(media.name, 35), this.searchQuery)}></h4>
            <div class="media-meta">
              ${this.renderMediaMeta(media)}
            </div>
          </div>
          
          <div class="media-actions">
            <span class="usage-count">${this.getUsageCount(media)} uses</span>
            <button 
              class="action-button"
              @click=${(e) => this.handleAction(e, 'copy', media)}
              title=${this.t('media.copyUrl')}
            >
              <svg class="action-icon">
                <use href="#copy"></use>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderMediaPreview(media, mediaType) {
    if (isImage(media.url) && media.hasError !== true) {
      return html`
        <img 
          class="media-image" 
          src=${media.url} 
          alt=${media.alt || media.name}
          loading="lazy"
          @error=${(e) => this.handleImageError(e, media)}
        />
      `;
    }

    if (isImage(media.url) && media.hasError === true) {
      return html`
        <div class="media-placeholder cors-error">
          <svg class="placeholder-icon">
            <use href="#photo"></use>
          </svg>
          <div class="cors-message">
            <small>CORS blocked</small>
            <small>${this.getDomainFromUrl(media.url)}</small>
          </div>
        </div>
      `;
    }

    return html`
      <div class="media-placeholder">
        <svg class="placeholder-icon">
          <use href="#${this.getMediaTypeIcon(mediaType)}"></use>
        </svg>
      </div>
    `;
  }

  getMediaTypeIcon(mediaType) {
    const iconMap = {
      image: 'photo',
      video: 'video',
      document: 'pdf',
      link: 'external-link',
    };
    return iconMap[mediaType] || 'photo';
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  truncateText(text, maxLength = 30) {
    if (!text || text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  renderMediaMeta(media) {
    const metaElements = [];

    if (media.doc) {
      const docName = media.doc.split('/').pop() || media.doc;
      metaElements.push(html`<span class="media-used-text">${docName}</span>`);
    }

    if (media.alt && media.alt !== 'null') {
      const altText = media.alt.length > 30 ? `${media.alt.substring(0, 30)}...` : media.alt;
      metaElements.push(html`<span class="media-used-text">Alt: ${altText}</span>`);
    }

    if (metaElements.length === 0) {
      metaElements.push(html`<span class="media-used-text">${this.t('media.notUsed')}</span>`);
    }

    return metaElements;
  }

  getUsageCount(media) {
    return media.usageCount || 0;
  }

  handleMediaClick(media) {
    this.dispatchEvent(new CustomEvent('mediaClick', {
      detail: { media },
      bubbles: true,
    }));
  }

  handleAction(e, action, media) {
    e.stopPropagation();

    this.dispatchEvent(new CustomEvent('mediaAction', {
      detail: { action, media },
      bubbles: true,
    }));
  }

  handleImageError(e, media) {
    media.hasError = true;

    e.target.style.display = 'none';

    this.requestUpdate();
  }

  highlightSearchTerm(text, query) {
    if (!query || !text) return text;

    let searchTerm = query;
    if (query.includes(':')) {
      const parts = query.split(':');
      if (parts.length > 1) {
        searchTerm = parts[1].trim();
      }
    }

    if (!searchTerm) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}

customElements.define('media-grid', MediaGrid);
