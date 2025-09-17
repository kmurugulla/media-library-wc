import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import { getMediaType, isImage } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import scanStyles from './scan.css?inline';

class MediaScanView extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    locale: { type: String },
  };

  static styles = getStyles(scanStyles);

  constructor() {
    super();
    this.mediaData = [];
    this.locale = 'en';
  }

  render() {
    if (!this.mediaData || this.mediaData.length === 0) {
      return html`
        <div class="empty-state">
          <svg class="empty-icon">
            <use href="#photo"></use>
          </svg>
          <h3>Scanning for Media</h3>
          <p>Discovering media files...</p>
        </div>
      `;
    }

    return html`
      <main class="scan-main">
        <div class="scan-grid">
          ${this.mediaData.map((media, index) => this.renderScanningCard(media, index))}
        </div>
      </main>
    `;
  }

  renderScanningCard(media, index) {
    const mediaType = getMediaType(media);

    return html`
      <div class="scan-card" data-index="${index}">
        <div class="scan-preview">
          ${this.renderMediaPreview(media, mediaType)}
          <div class="scan-type-badge">
            <svg class="scan-type-icon">
              <use href="#${this.getMediaTypeIcon(mediaType)}"></use>
            </svg>
          </div>
        </div>
        
        <div class="scan-info">
          <h4 class="scan-name" title="${media.name}">${this.truncateText(media.name, 35)}</h4>
        </div>
      </div>
    `;
  }

  renderMediaPreview(media, mediaType) {
    if (isImage(media.url) && media.hasError !== true) {
      return html`
        <img 
          class="scan-image" 
          src=${media.url} 
          alt=${media.alt || media.name}
          loading="lazy"
          @error=${(e) => this.handleImageError(e, media)}
        />
      `;
    }

    if (isImage(media.url) && media.hasError === true) {
      return html`
        <div class="scan-placeholder cors-error">
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
      <div class="scan-placeholder">
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
      pdf: 'pdf',
    };
    return iconMap[mediaType] || 'photo';
  }

  isImage(url) {
    if (!url) return false;
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
    const ext = url.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(ext);
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  handleImageError(e, media) {
    media.hasError = true;
    this.requestUpdate();
  }
}

customElements.define('media-scan-view', MediaScanView);
