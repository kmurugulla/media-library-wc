// src/components/list/list.js
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LocalizableElement } from '../base-localizable.js';
import getSvg from '../../utils/getSvg.js';
import { getMediaType, isImage, isVideo, isPdf, formatFileSize } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import listStyles from './list.css?inline';

class MediaList extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    searchQuery: { type: String },
    locale: { type: String }
  };

  static styles = getStyles(listStyles);

  constructor() {
    super();
    this.mediaData = [];
    this.searchQuery = '';
    this.locale = 'en';
  }

  async connectedCallback() {
    super.connectedCallback();
    
    await this.loadIcons();
  }

  async loadIcons() {
    const ICONS = [
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/pdf.svg',
      '/src/icons/external-link.svg',
      '/src/icons/copy.svg'
    ];
    
    const existingIcons = this.shadowRoot.querySelectorAll('svg[id]');
    if (existingIcons.length === 0) {
      await getSvg({ parent: this.shadowRoot, paths: ICONS });
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
        <div class="list-content">
          <div class="list-grid">
            ${repeat(this.mediaData, (media) => media.url, (media, i) => {
              return this.renderListItem(media, i);
            })}
          </div>
        </div>
      </main>
    `;
  }

  renderListItem(media, index) {
    const mediaType = getMediaType(media);
    
    return html`
      <div 
        class="media-item" 
        data-index="${index}"
        @click=${() => this.handleMediaClick(media)}
      >
        <div class="media-thumbnail">
          ${this.renderThumbnail(media, mediaType)}
        </div>
        
        <div class="media-info">
          <h4 class="media-name" title=${media.name}>${this.truncateText(media.name, 35)}</h4>
          <p class="media-url" title=${media.url}>${this.getShortUrl(media.url)}</p>
        </div>
        
        <div class="media-type">
          ${this.getDisplayMediaType(mediaType)}
        </div>
        
        <div class="media-doc" title=${media.doc || ''}>
          ${this.getShortDoc(media.doc)}
        </div>
        
        <div class="media-alt" title=${media.alt || ''}>
          ${this.getShortAlt(media.alt)}
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
    return text.substring(0, maxLength) + '...';
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
    return alt.length > 20 ? alt.substring(0, 20) + '...' : alt;
  }

  handleMediaClick(media) {
    this.dispatchEvent(new CustomEvent('mediaClick', {
      detail: { media },
      bubbles: true
    }));
  }

  handleAction(e, action, media) {
    e.stopPropagation();
    
    this.dispatchEvent(new CustomEvent('mediaAction', {
      detail: { action, media },
      bubbles: true
    }));
  }

  handleImageError(e, media) {
    media.hasError = true;
    
    e.target.style.display = 'none';
    
    this.requestUpdate();
  }
}

customElements.define('media-list', MediaList);
