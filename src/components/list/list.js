import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ref, createRef } from 'lit/directives/ref.js';
import LocalizableElement from '../base-localizable.js';
import getSvg from '../../utils/get-svg.js';
import { getMediaType, isImage } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import { ListVirtualScrollManager } from '../../utils/virtual-scroll/scroll.js';
import listStyles from './list.css?inline';

class MediaList extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    searchQuery: { type: String },
    locale: { type: String },
    visibleStart: { type: Number },
    visibleEnd: { type: Number },
  };

  static styles = getStyles(listStyles);

  constructor() {
    super();
    this.mediaData = [];
    this.searchQuery = '';
    this.locale = 'en';

    this.visibleStart = 0;
    this.visibleEnd = 50;

    this.containerRef = createRef();

    this.virtualScroll = new ListVirtualScrollManager({
      onRangeChange: (range) => {
        this.visibleStart = range.start;
        this.visibleEnd = range.end;
        requestAnimationFrame(() => {
          this.requestUpdate();
        });
      },
    });
  }

  async connectedCallback() {
    super.connectedCallback();

    await this.loadIcons();
  }

  firstUpdated() {
    this.setupScrollListener();
    window.addEventListener('resize', () => {
      this.virtualScroll.updateContainerDimensions();
    });
  }

  shouldUpdate(changedProperties) {
    return changedProperties.has('mediaData')
           || changedProperties.has('searchQuery')
           || changedProperties.has('visibleStart')
           || changedProperties.has('visibleEnd')
           || changedProperties.has('locale');
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

  setupScrollListener() {
    requestAnimationFrame(() => {
      const container = this.containerRef.value;
      if (container) {
        this.virtualScroll.init(container, this.mediaData?.length || 0);
        this.virtualScroll.calculateVisibleRange();
        this.virtualScroll.onVisibleRangeChange();
      }
    });
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
    const loadedIconIds = Array.from(existingIcons).map((icon) => icon.id);
    const missingIcons = ICONS.filter((iconPath) => {
      const iconId = iconPath.split('/').pop().replace('.svg', '');
      return !loadedIconIds.includes(iconId);
    });

    if (missingIcons.length > 0) {
      await getSvg({ parent: this.shadowRoot, paths: missingIcons });
    }
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

    const totalHeight = this.virtualScroll.getTotalHeight();
    const visibleItems = this.mediaData.slice(this.visibleStart, this.visibleEnd);

    return html`
      <main class="list-main">
        <div class="list-header">
          <div class="header-cell"></div>
          <div class="header-cell">${this.t('media.fileName')}</div>
          <div class="header-cell">Type</div>
          <div class="header-cell">Document</div>
          <div class="header-cell">Alt Text</div>
          <div class="header-cell">Actions</div>
        </div>
        <div class="list-content" ${ref(this.containerRef)}>
          <div class="list-grid" style="height: ${totalHeight}px;">
            ${repeat(visibleItems, (media) => media.url, (media, i) => {
    const index = this.visibleStart + i;
    const offset = this.virtualScroll.getItemOffset(index);
    return this.renderListItem(media, index, offset);
  })}
          </div>
        </div>
      </main>
    `;
  }

  renderListItem(media, index, offset) {
    const mediaType = getMediaType(media);

    return html`
      <div 
        class="media-item" 
        data-index="${index}"
        style="position: absolute; top: ${offset}px; left: 0; right: 0;"
        @click=${() => this.handleMediaClick(media)}
      >
        <div class="media-thumbnail">
          ${this.renderThumbnail(media, mediaType)}
        </div>
        
        <div class="media-info">
          <h4 class="media-name" title=${media.name} .innerHTML=${this.highlightSearchTerm(this.truncateText(media.name, 35), this.searchQuery)}></h4>
          <p class="media-url" title=${media.url} .innerHTML=${this.highlightSearchTerm(this.getShortUrl(media.url), this.searchQuery)}></p>
        </div>
        
        <div class="media-type">
          ${this.getDisplayMediaType(mediaType)}
        </div>
        
        <div class="media-doc" title=${media.doc || ''} .innerHTML=${this.highlightSearchTerm(this.getShortDoc(media.doc), this.searchQuery)}>
        </div>
        
        <div class="media-alt" title=${media.alt || ''} .innerHTML=${this.highlightSearchTerm(this.getShortAlt(media.alt), this.searchQuery)}>
        </div>
        
        <div class="media-actions">
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
    `;
  }

  renderThumbnail(media, mediaType) {
    if (isImage(media.url) && media.hasError !== true) {
      return html`
        <img 
          src=${media.url} 
          alt=${media.alt || media.name}
          loading="lazy"
          @error=${(e) => this.handleImageError(e, media)}
        />
      `;
    }

    if (isImage(media.url) && media.hasError === true) {
      return html`
        <div class="placeholder cors-error">
          <svg class="placeholder-icon">
            <use href="#photo"></use>
          </svg>
          <div class="cors-message">
            <small>CORS</small>
          </div>
        </div>
      `;
    }

    return html`
      <div class="placeholder">
        <svg class="placeholder-icon">
          <use href="#${this.getMediaTypeIcon(mediaType)}"></use>
        </svg>
      </div>
    `;
  }

  getMediaTypeIcon(mediaType) {
    switch (mediaType) {
      case 'image': return 'photo';
      case 'video': return 'video';
      case 'document': return 'pdf';
      case 'link': return 'external-link';
      default: return 'photo';
    }
  }

  truncateText(text, maxLength = 30) {
    if (!text || text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  getDisplayMediaType(mediaType) {
    switch (mediaType) {
      case 'image': return 'IMG';
      case 'video': return 'VID';
      case 'document': return 'DOC';
      case 'link': return 'LNK';
      default: return 'FILE';
    }
  }

  getShortUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || urlObj.hostname;
    } catch {
      return url.split('/').pop() || url;
    }
  }

  getShortDoc(doc) {
    if (!doc) return this.t('media.notUsed');
    return doc.split('/').pop() || doc;
  }

  getShortAlt(alt) {
    if (!alt || alt === 'null') return '—';
    return alt;
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

customElements.define('media-list', MediaList);
