// src/components/grid/grid.js
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { LocalizableElement } from '../base-localizable.js';
import getSvg from '../../utils/getSvg.js';
import { getMediaType, isImage, isVideo, isPdf } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import gridStyles from './grid.css?inline';

class MediaGrid extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    searchQuery: { type: String },
    locale: { type: String }
  };

  static styles = getStyles(gridStyles);


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
      <main class="media-main">
        <div class="media-grid">
          ${repeat(this.mediaData, (media) => media.url, (media, index) => {
            return this.renderMediaCard(media, index);
          })}
        </div>
      </main>
    `;
  }

  renderMediaCard(media, index) {
    const mediaType = getMediaType(media);
    
    return html`
      <div 
        class="media-card" 
        data-index="${index}"
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
            <h4 class="media-name" title=${media.name}>${media.name}</h4>
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
    if (isImage(media.url) && !media.hasError) {
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
    
    return html`
      <div class="media-placeholder">
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

  renderMediaMeta(media) {
    const metaElements = [];
    
    if (media.doc) {
      const docName = media.doc.split('/').pop() || media.doc;
      metaElements.push(html`<span class="media-used-text">${docName}</span>`);
    }
    
    if (media.alt && media.alt !== 'null') {
      const altText = media.alt.length > 30 ? media.alt.substring(0, 30) + '...' : media.alt;
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
    // Mark the media item as having an error instead of direct DOM manipulation
    media.hasError = true;
    
    // Hide the image and trigger a re-render
    e.target.style.display = 'none';
    
    // Request an update to re-render with the error state
    this.requestUpdate();
  }

}

customElements.define('media-grid', MediaGrid);
