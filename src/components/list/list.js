// src/components/list/list.js
import { html } from 'lit';
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
    
    // Load SVG icons using Franklin approach
    const ICONS = [
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/external-link.svg',
      '/src/icons/eye.svg',
      '/src/icons/copy.svg'
    ];
    
    getSvg({ parent: this.shadowRoot, paths: ICONS });
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
      <div class="media-list">
        <div class="list-header">
          <div></div>
          <div>${this.t('media.fileName')}</div>
          <div>Type</div>
          <div>Document</div>
          <div>Alt Text</div>
          <div>Actions</div>
        </div>
        ${this.mediaData.map(media => this.renderListItem(media))}
      </div>
    `;
  }

  renderListItem(media) {
    const mediaType = getMediaType(media);
    
    return html`
      <div class="list-item" @click=${() => this.handleMediaClick(media)}>
        <div class="media-thumbnail">
          ${this.renderThumbnail(media, mediaType)}
        </div>
        
        <div class="media-info">
          <h4 class="media-name" title=${media.name}>${media.name}</h4>
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
            @click=${(e) => this.handleAction(e, 'view', media)}
            title=${this.t('media.viewDetails')}
          >
            <svg class="action-icon">
              <use href="#eye"></use>
            </svg>
          </button>
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
    if (isImage(media.url)) {
      return html`
        <img 
          src=${media.url} 
          alt=${media.alt || media.name}
          loading="lazy"
          @error=${this.handleImageError}
        />
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
      case 'document': return 'external-link';
      case 'link': return 'external-link';
      default: return 'photo';
    }
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

  handleImageError(e) {
    e.target.style.display = 'none';
    e.target.parentElement.innerHTML = `
      <div class="placeholder">
        <svg class="placeholder-icon">
          <use href="#photo"></use>
        </svg>
      </div>
    `;
  }
}

customElements.define('media-list', MediaList);
