import { html } from 'lit';
// eslint-disable-next-line import/no-extraneous-dependencies -- virtualizer in deps
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';
// eslint-disable-next-line import/no-extraneous-dependencies -- virtualizer in deps
import { grid } from '@lit-labs/virtualizer/layouts/grid.js';
import LocalizableElement from '../base-localizable.js';
import { getMediaType, isImage, isVideo, getVideoThumbnail, isExternalVideoUrl } from '../../utils/utils.js';
import { getStyles } from '../../utils/get-styles.js';
import getSvg from '../../utils/get-svg.js';
import gridStyles from './grid.css?inline';

class MediaGrid extends LocalizableElement {
  static properties = {
    mediaData: { type: Array },
    searchQuery: { type: String },
    locale: { type: String },
    isProcessing: { type: Boolean },
  };

  static styles = getStyles(gridStyles);

  constructor() {
    super();
    this.mediaData = [];
    this.searchQuery = '';
    this.locale = 'en';
    this.isProcessing = false;
  }

  async firstUpdated() {
    // Load icons after first render when shadowRoot is fully ready
    const ICONS = [
      '/dist/icons/photo.svg',
      '/dist/icons/video.svg',
      '/dist/icons/pdf.svg',
      '/dist/icons/external-link.svg',
      '/dist/icons/copy.svg',
      '/dist/icons/share.svg',
      '/dist/icons/accessibility.svg',
      '/dist/icons/play.svg',
    ];
    await getSvg({ parent: this.shadowRoot, paths: ICONS });
  }

  shouldUpdate(changedProperties) {
    return changedProperties.has('mediaData')
           || changedProperties.has('searchQuery')
           || changedProperties.has('isProcessing')
           || changedProperties.has('locale');
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
      <main class="media-main" id="grid-scroller">
        ${virtualize({
    items: this.mediaData,
    renderItem: (media) => this.renderMediaCard(media),
    keyFunction: (media) => media?.url || '',
    scroller: true,
    layout: grid({
      gap: '24px',
      minColumnWidth: '240px',
      maxColumnWidth: '350px',
    }),
  })}
      </main>
    `;
  }

  renderMediaCard(media) {
    if (!media) return html``;

    const mediaType = getMediaType(media);
    const usageCount = media.usageCount || 0;
    const subtype = this.getSubtype(media);

    return html`
      <div class="media-card">
        <div class="media-preview clickable" @click=${() => this.handleMediaClick(media)}>
          ${this.renderMediaPreview(media, mediaType)}
          
          <div class="media-info clickable" @click=${() => this.handleMediaClick(media)}>
            <div class="media-meta">
              <span class="media-label media-used">${usageCount}</span>
              ${subtype ? html`<span class="media-label media-subtype">${subtype}</span>` : ''}
            </div>
            
            <div class="media-actions">
              ${this.renderAltStatus(media, mediaType)}
              <button 
                class="share-button"
                @click=${(e) => this.handleAction(e, 'copy', media)}
                title=${this.t('media.copyUrl')}
              >
                <svg>
                  <use href="#share"></use>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAltStatus(media, mediaType) {
    // Only show alt indicator for images (not videos or documents)
    if (mediaType === 'image' && media.alt && media.alt !== '' && media.alt !== null) {
      return html`
        <div class="filled-alt-indicator" title="Has alt text: ${media.alt}">
          <svg>
            <use href="#accessibility"></use>
          </svg>
        </div>
      `;
    }
    return '';
  }

  getSubtype(media) {
    if (!media.type) return '';
    const parts = media.type.split(' > ');
    if (parts.length > 1) {
      return parts[1].toUpperCase();
    }
    return '';
  }

  getDisplayMediaType(mediaType) {
    const typeMap = {
      image: 'IMAGE',
      video: 'VIDEO',
      document: 'PDF',
      link: 'LINK',
      icon: 'SVG',
    };
    return typeMap[mediaType] || mediaType.toUpperCase();
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

    if (isVideo(media.url) && media.hasError !== true) {
      return this.renderVideoPreview(media);
    }

    if (isVideo(media.url) && media.hasError === true) {
      return html`
        <div class="media-placeholder cors-error">
          <svg class="placeholder-icon">
            <use href="#video"></use>
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

  renderVideoPreview(media) {
    // Check if it's an external video URL (YouTube, Vimeo, etc.)
    if (isExternalVideoUrl(media.url)) {
      const thumbnail = getVideoThumbnail(media.url);
      return html`
        <div class="video-thumbnail-container">
          ${thumbnail ? html`
            <img 
              class="video-thumbnail" 
              src=${thumbnail} 
              alt=${media.alt || media.name}
              loading="lazy"
              @error=${(e) => this.handleVideoThumbnailError(e, media)}
            />
          ` : html`
            <div class="video-placeholder">
              <svg class="video-icon">
                <use href="#video"></use>
              </svg>
            </div>
          `}
          <div class="video-play-overlay">
            <svg class="play-icon">
              <use href="#play"></use>
            </svg>
          </div>
        </div>
      `;
    }

    // Regular video file - show first frame with play overlay
    return html`
      <div class="video-preview-container">
        <video 
          class="media-video" 
          src=${media.url} 
          preload="metadata"
          muted
          @error=${(e) => this.handleVideoError(e, media)}
          @loadedmetadata=${(e) => this.handleVideoLoaded(e, media)}
        />
        <div class="video-play-overlay">
          <svg class="play-icon">
            <use href="#play"></use>
          </svg>
        </div>
      </div>
    `;
  }

  handleImageError(e, media) {
    media.hasError = true;
    e.target.style.display = 'none';
    this.requestUpdate();
  }

  handleVideoError(e, media) {
    media.hasError = true;
    e.target.style.display = 'none';
    this.requestUpdate();
  }

  handleVideoThumbnailError(e) {
    e.target.style.display = 'none';
    this.requestUpdate();
  }

  handleVideoLoaded(e) {
    // Seek to first frame for thumbnail
    const video = e.target;
    if (video.duration > 0) {
      video.currentTime = 0.1;
    }
  }
}

customElements.define('media-grid', MediaGrid);
