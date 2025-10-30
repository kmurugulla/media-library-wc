import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import getSvg from '../../utils/get-svg.js';
import { getStyles } from '../../utils/get-styles.js';
import { getVideoThumbnail, isExternalVideoUrl } from '../../utils/utils.js';
import mediaDetailsStyles from './media-details.css?inline';

class MediaDetails extends LocalizableElement {
  static properties = {
    locale: { type: String },
    isOpen: { type: Boolean },
    modalData: { type: Object },
    aiEnabled: { type: Boolean },
    aiWorkerUrl: { type: String },
    aiApiKey: { type: String },
    siteKey: { type: String },
    _activeTab: { state: true },
    _mimeType: { state: true },
    _fileSize: { state: true },
    _mediaOrigin: { state: true },
    _mediaPath: { state: true },
    _exifData: { state: true },
    _aiSuggestions: { state: true },
    _loadingSuggestion: { state: true },
  };

  static styles = getStyles(mediaDetailsStyles);

  constructor() {
    super();
    this.locale = 'en';
    this.isOpen = false;
    this.modalData = null;
    this.aiEnabled = false;
    this.aiWorkerUrl = '';
    this.aiApiKey = '';
    this._activeTab = 'usage';
    this._mimeType = null;
    this._fileSize = null;
    this._mediaOrigin = null;
    this._mediaPath = null;
    this._exifData = null;
    this._aiSuggestions = {}; // Store by hash
    this._loadingSuggestion = null; // Which occurrence is being analyzed
  }

  connectedCallback() {
    super.connectedCallback();

    window.addEventListener('open-modal', this.handleOpenModal);
    window.addEventListener('close-modal', this.handleCloseModal);
  }

  async updated(changedProperties) {
    // Load icons when modal opens (check if they're missing each time)
    if (changedProperties.has('isOpen') && this.isOpen) {
      // Check if icons are already in shadowRoot
      const existingIcons = this.shadowRoot.querySelectorAll('svg[id], g[id]');

      if (existingIcons.length === 0) {
        // Icons missing, load them
        const ICONS = [
          'deps/icons/close.svg',
          'deps/icons/photo.svg',
          'deps/icons/video.svg',
          'deps/icons/pdf.svg',
          'deps/icons/external-link.svg',
          'deps/icons/copy.svg',
          'deps/icons/eye.svg',
          'deps/icons/reference.svg',
          'deps/icons/info.svg',
          'deps/icons/open-in.svg',
          'deps/icons/play.svg',
          'deps/icons/sparkle.svg',
        ];
        await getSvg({ parent: this.shadowRoot, paths: ICONS });
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('open-modal', this.handleOpenModal);
    window.removeEventListener('close-modal', this.handleCloseModal);
  }

  handleOpenModal = async (e) => {
    window.dispatchEvent(new Event('close-modal'));

    this.modalData = e.detail;
    this.isOpen = true;

    // Load metadata and EXIF when modal opens
    const { media } = e.detail.data;
    if (media) {
      await this.loadFileMetadata(media);
      if (this.isImage(media.url)) {
        await this.loadExifData(media);
      }
    }
  };

  handleCloseModal = () => {
    this.isOpen = false;
    this.modalData = null;
    this._activeTab = 'usage';
    this._mimeType = null;
    this._fileSize = null;
    this._mediaOrigin = null;
    this._mediaPath = null;
    this._exifData = null;
  };

  handleTabChange = (e) => {
    const { tab } = e.target.dataset;
    this._activeTab = tab;
  };

  getUsageCount() {
    const usageCount = this.modalData?.data?.media?.usageCount || 0;
    return usageCount;
  }

  getAltTextDisplay(alt, mediaType = null) {
    // Alt text is only applicable for images
    // For videos, PDFs, links, and other non-image types, show N/A
    if (mediaType && !mediaType.startsWith('img')) {
      return html`<span class="alt-na">N/A</span>`;
    }

    if (alt === null) {
      return html`
        <span class="alt-missing">
          <svg class="alt-status-icon missing" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm1 13H7V7h2v6zm0-8H7V3h2v2z"/>
          </svg>
          Missing Alt
        </span>
      `;
    }
    if (alt === '') {
      return html`
        <span class="alt-decorative">
          <svg class="alt-status-icon decorative" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="7" stroke="currentColor" fill="none" stroke-width="2"/>
            <circle cx="8" cy="8" r="3" fill="currentColor"/>
          </svg>
          Decorative
        </span>
      `;
    }
    return html`
      <span class="alt-filled">
        <svg class="alt-status-icon filled" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-1.5 12L3 8.5l1.4-1.4 2.1 2.1 4.1-4.1L12 6.5 6.5 12z"/>
        </svg>
        ${alt}
      </span>
    `;
  }

  formatContextAsHtml(context) {
    if (!context) return html`<span class="no-context">No context available</span>`;

    const parts = context.split(' > ');
    const contextItems = [];

    parts.forEach((part) => {
      if (part.startsWith('In:')) {
        const containerInfo = part.replace('In:', '').trim();
        if (containerInfo && containerInfo !== 'undefined' && containerInfo.length > 0) {
          const simplified = this.simplifyContainerInfo(containerInfo);
          contextItems.push(html`
            <div class="context-item">
              <span class="context-label">Container</span>
              <span class="context-value">${simplified}</span>
            </div>
          `);
        }
      } else if (part.startsWith('text:')) {
        const textInfo = part.replace('text:', '').trim();
        if (textInfo && textInfo !== 'undefined' && textInfo.length > 0) {
          const cleanedText = this.cleanTextContent(textInfo);
          if (cleanedText) {
            const truncated = this.truncateText(cleanedText, 200);
            contextItems.push(html`
              <div class="context-item">
                <span class="context-label">Text</span>
                <span class="context-value">${truncated}</span>
              </div>
            `);
          }
        }
      }
    });

    if (contextItems.length === 0) {
      return html`<span class="no-context">No context available</span>`;
    }

    return html`<div class="context-container">${contextItems}</div>`;
  }

  simplifyContainerInfo(containerInfo) {
    if (!containerInfo) return '';

    const simplified = containerInfo
      .replace(/max-md:[^-\s]+/g, '')
      .replace(/!-[^-\s]+/g, '')
      .replace(/calc\([^)]+\)/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (simplified && simplified.length > 0 && simplified !== 'undefined') {
      return simplified;
    }
    const meaningfulParts = containerInfo.split(' ').filter((part) => part.length > 2
      && !part.includes('max-md')
      && !part.includes('!-')
      && !part.includes('calc')
      && !part.includes('[')
      && !part.includes(']'));

    return meaningfulParts.length > 0 ? meaningfulParts[0] : 'Container';
  }

  cleanTextContent(text) {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');

    if (lastSpaceIndex > maxLength * 0.8) {
      return `${text.substring(0, lastSpaceIndex)}...`;
    }
    return `${truncated}...`;
  }

  convertMarkdownToHtml(text) {
    const lines = text.split('\n');
    return html`<div>${lines.map((line) => {
      if (line.trim() === '') return html`<br>`;

      const parts = line.split(/(\*\*.*?\*\*)/g);
      return html`<div>${parts.map((part) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return html`<strong>${boldText}</strong>`;
        }
        return part;
      })}</div>`;
    })}</div>`;
  }

  render() {
    if (!this.isOpen || !this.modalData) {
      return html``;
    }

    return html`
      <div class="modal-overlay" ?open=${this.isOpen} @click=${this.handleOverlayClick}>
        <div class="modal-content" @click=${this.handleContentClick}>
          <!-- Left Column: Preview -->
          <div class="media-preview-section">
            ${this.renderModalPreview()}
          </div>
          
          <!-- Right Column: Details -->
          <div class="modal-details">
            <div class="modal-header">
              <h2 class="modal-title">${this.getModalTitle()}</h2>
              <div class="media-source">${this.getMediaOriginFilename()}</div>
              <button class="close-button" @click=${this.handleCloseModal} title="Close">
                <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="modal-tabs">
              <button 
                type="button"
                class="tab-btn ${this._activeTab === 'usage' ? 'active' : ''}"
                data-tab="usage"
                @click=${this.handleTabChange}
              >
                <svg class="tab-icon" width="20" height="20">
                  <use href="#reference"></use>
                </svg>
                ${this.getUsageCount()} ${this.getUsageCount() === 1 ? 'Reference' : 'References'}
              </button>
              <button 
                type="button"
                class="tab-btn ${this._activeTab === 'metadata' ? 'active' : ''}"
                data-tab="metadata"
                @click=${this.handleTabChange}
              >
                <svg class="tab-icon" width="20" height="20">
                  <use href="#info"></use>
                </svg>
                Metadata
              </button>
            </div>
            
            <div class="modal-body">
              ${this._activeTab === 'usage' ? this.renderUsageTab() : this.renderMetadataTab()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderUsageTab() {
    const { usageData, isScanning } = this.modalData.data;

    if (!usageData || usageData.length === 0) {
      return html`
        <div class="no-usage">
          <p>${isScanning ? 'Calculating references...' : 'Not Used'}</p>
        </div>
      `;
    }

    const groupedUsages = usageData.reduce((groups, usage) => {
      const doc = usage.doc || 'Unknown Document';
      if (!groups[doc]) {
        groups[doc] = [];
      }
      groups[doc].push(usage);
      return groups;
    }, {});

    return html`
      <div class="usage-sections">
        ${Object.entries(groupedUsages).map(([doc, usages]) => html`
          <div class="usage-section">
            <div class="document-heading">
              <div>
                <h3>${doc}</h3>
                <div class="document-path">${usages.length} ${usages.length === 1 ? 'Reference' : 'References'}</div>
              </div>
              <button 
                class="action-button open-page-button" 
                @click=${() => this.handleViewDocument(doc)} 
                title="Open page in new tab"
              >
                <svg class="action-icon" width="16" height="16" viewBox="0 0 20 20">
                  <use href="#open-in"></use>
                </svg>
              </button>
            </div>
            ${usages[0]?.type?.startsWith('img') ? html`
              <h5 class="usage-title">Alt</h5>
              <div class="usage-container">
                ${usages.map((usage, index) => {
    const usageHash = `${doc}_${index}`;
    const suggestion = this._aiSuggestions[usageHash];
    const isLoading = this._loadingSuggestion === usageHash;

    return html`
                    <div class="usage-row ${suggestion ? 'has-suggestion' : ''}">
                      <div class="usage-alt">
                        ${this.getAltTextDisplay(usage.alt, usage.type)}
                      </div>
                      <div class="usage-actions">
                        ${this.aiEnabled ? html`
                          <button 
                            class="action-button ai-suggest-button" 
                            @click=${() => this.handleGetAISuggestion(doc, index, usageHash)}
                            ?disabled=${isLoading}
                            title="Get AI recommendation"
                          >
                            ${isLoading ? html`
                              <span class="spinner"></span>
                            ` : html`
                              <svg class="action-icon" width="16" height="16" viewBox="0 0 20 20">
                                <use href="#sparkle"></use>
                              </svg>
                            `}
                          </button>
                        ` : ''}
                        <button 
                          class="action-button" 
                          @click=${() => this.handleViewMedia(this.modalData.data.media.url)} 
                          title="Open media in new tab"
                        >
                          <svg class="action-icon" width="16" height="16" viewBox="0 0 20 20">
                            <use href="#open-in"></use>
                          </svg>
                        </button>
                      </div>
                    </div>
                    ${suggestion ? this.renderAISuggestion(suggestion) : ''}
                  `;
  })}
              </div>
            ` : ''}
          </div>
        `)}
      </div>
    `;
  }

  renderMetadataTab() {
    return html`
      <div class="metadata-section">
        <div class="metadata-table-container">
          <table class="metadata-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr class="metadata-row">
                <td class="metadata-label">MIME Type</td>
                <td class="metadata-value">${this._mimeType || 'Loading...'}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">File Size</td>
                <td class="metadata-value">${this._fileSize || 'Loading...'}</td>
              </tr>
              ${this._imageDimensions ? html`
                <tr class="metadata-row">
                  <td class="metadata-label">Width</td>
                  <td class="metadata-value">${this._imageDimensions.width}px</td>
                </tr>
                <tr class="metadata-row">
                  <td class="metadata-label">Height</td>
                  <td class="metadata-value">${this._imageDimensions.height}px</td>
                </tr>
                <tr class="metadata-row">
                  <td class="metadata-label">Orientation</td>
                  <td class="metadata-value">${(() => {
    if (this._imageDimensions.width === this._imageDimensions.height) {
      return 'square';
    }
    return this._imageDimensions.width > this._imageDimensions.height ? 'landscape' : 'portrait';
  })()}</td>
                </tr>
              ` : ''}
              <tr class="metadata-row">
                <td class="metadata-label">Origin</td>
                <td class="metadata-value">${this._mediaOrigin || 'Loading...'}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">Path</td>
                <td class="metadata-value">${this._mediaPath || 'Loading...'}</td>
              </tr>
              
              ${this.renderExifSection()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderAnalysisMetadata(media) {
    const hasAnalysisData = media.orientation || media.category || media.width || media.height
      || media.exifCamera || media.exifDate;

    if (!hasAnalysisData) {
      return html`
        <tr class="metadata-row analysis-section">
          <td class="metadata-label">Analysis</td>
          <td class="metadata-value analysis-unavailable">No analysis data available</td>
        </tr>
      `;
    }

    return html`
      <tr class="metadata-row analysis-section">
        <td class="metadata-label">Analysis</td>
        <td class="metadata-value"></td>
      </tr>
      ${media.orientation ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Orientation</td>
          <td class="metadata-value">${media.orientation}</td>
        </tr>
      ` : ''}
      ${media.category ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Category</td>
          <td class="metadata-value">${media.category}</td>
        </tr>
      ` : ''}
      ${media.width && media.height ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Dimensions</td>
          <td class="metadata-value">${media.width} x ${media.height}px</td>
        </tr>
      ` : ''}
      ${this.renderCameraInfo(media)}
      ${media.exifDate ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Date Taken</td>
          <td class="metadata-value">${media.exifDate}</td>
        </tr>
      ` : ''}
      ${media.analysisConfidence ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Confidence</td>
          <td class="metadata-value">${media.analysisConfidence}</td>
        </tr>
      ` : ''}
    `;
  }

  renderCameraInfo(media) {
    if (!media.exifCamera || media.exifCamera === 'undefined undefined' || media.exifCamera === 'undefined') {
      return '';
    }

    return html`
      <tr class="metadata-row analysis-subrow">
        <td class="metadata-label">Camera</td>
        <td class="metadata-value">${media.exifCamera}</td>
      </tr>
    `;
  }

  getAbsoluteMediaUrl(media) {
    if (!media || !media.url) return '';
    try {
      const u = new URL(media.url);
      return u.toString();
    } catch {
      try {
        if (media.doc) {
          const base = new URL(media.doc, window.location.origin);
          return new URL(media.url, base).toString();
        }
      } catch {
        // fall through
      }
      return media.url;
    }
  }

  async loadFileMetadata(media) {
    if (!media || !media.url) return;

    try {
      const absUrl = this.getAbsoluteMediaUrl(media);
      const url = new URL(absUrl);

      // Set origin and path
      this._mediaOrigin = url.origin;
      this._mediaPath = url.pathname;

      // Get file extension and set MIME type
      const ext = this.getFileExtension(absUrl).toLowerCase();
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        webm: 'video/webm',
        pdf: 'application/pdf',
      };
      this._mimeType = mimeTypes[ext] || 'Unknown';

      // Try to get file size using CORS proxy
      try {
        const corsProxyUrl = `https://media-library-cors-proxy.aem-poc-lab.workers.dev/?url=${encodeURIComponent(absUrl)}`;

        // Try HEAD request first
        let response = await fetch(corsProxyUrl, { method: 'HEAD' });

        if (response.ok) {
          const size = response.headers.get('content-length');
          if (size) {
            this._fileSize = this.formatFileSize(parseInt(size, 10));
          } else {
            // If HEAD doesn't return content-length, try GET
            response = await fetch(corsProxyUrl, { method: 'GET' });
            if (response.ok) {
              const blob = await response.blob();
              this._fileSize = this.formatFileSize(blob.size);
            } else {
              this._fileSize = 'Unknown';
            }
          }
        } else {
          this._fileSize = 'Unknown';
        }
      } catch (error) {
        this._fileSize = 'Unknown';
      }
    } catch {
      this._mediaOrigin = 'Unknown';
      this._mediaPath = 'Unknown';
      this._mimeType = 'Unknown';
      this._fileSize = 'Unknown';
    }
  }

  async loadExifData(media) {
    const imageUrl = this.getAbsoluteMediaUrl(media);
    if (!imageUrl) return;

    try {
      if (!window.exifr) {
        await this.loadExifrLibrary();
      }

      const corsProxyUrl = `https://media-library-cors-proxy.aem-poc-lab.workers.dev/?url=${encodeURIComponent(imageUrl)}`;

      const response = await fetch(corsProxyUrl, { method: 'GET' });
      if (!response.ok) {
        this._exifData = null;
        return;
      }

      const blob = await response.blob();

      const exifrData = await window.exifr.parse(blob, {
        tiff: true,
        xmp: true,
        iptc: true,
        icc: true,
      });

      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
      });

      this._imageDimensions = dimensions;
      this._exifData = exifrData || null;
    } catch (error) {
      this._exifData = null;
    }
  }

  async loadExifrLibrary() {
    return new Promise((resolve, reject) => {
      if (window.exifr) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/exifr/dist/full.umd.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load exifr library'));
      document.head.appendChild(script);
    });
  }

  renderExifSection() {
    if (!this._exifData || Object.keys(this._exifData).length === 0) {
      return '';
    }

    const md = this._exifData || {};

    const cameraMake = md.Make;
    const cameraModel = md.Model;
    const lens = md.LensModel;
    const iso = md.ISO || md.ISOSpeedRatings;
    const aperture = md.FNumber;
    const shutter = md.ExposureTime;
    const focal = md.FocalLength;
    const dateTime = md.DateTimeOriginal || md.DateTime;
    const gpsLat = md.latitude;
    const gpsLong = md.longitude;
    const gpsAlt = md.GPSAltitude;
    const iptcKeywords = md.Keywords;
    const iptcCaption = md.Caption || md.ImageDescription;
    const iptcCopyright = md.Copyright;
    const iptcCreator = md.Creator || md.Artist;
    const xmpRating = md.Rating;
    const xmpSubject = md.Subject;

    const rows = [];
    if (cameraMake) rows.push(['Camera Make', cameraMake]);
    if (cameraModel) rows.push(['Camera Model', cameraModel]);
    if (lens) rows.push(['Lens', lens]);
    if (iso) rows.push(['ISO', iso]);
    if (aperture) rows.push(['Aperture', `f/${aperture}`]);
    if (shutter) rows.push(['Shutter Speed', `${shutter}s`]);
    if (focal) rows.push(['Focal Length', `${focal}mm`]);
    if (dateTime) rows.push(['Date Captured', dateTime]);
    if (gpsLat) rows.push(['Latitude', Number(gpsLat).toFixed(6)]);
    if (gpsLong) rows.push(['Longitude', Number(gpsLong).toFixed(6)]);
    if (gpsAlt) rows.push(['Altitude', `${gpsAlt}m`]);
    if (iptcKeywords) rows.push(['Keywords', Array.isArray(iptcKeywords) ? iptcKeywords.join(', ') : iptcKeywords]);
    if (iptcCaption) rows.push(['Caption', iptcCaption]);
    if (iptcCopyright) rows.push(['Copyright', iptcCopyright]);
    if (iptcCreator) rows.push(['Creator', iptcCreator]);
    if (xmpRating) rows.push(['Rating', xmpRating]);
    if (xmpSubject) rows.push(['Subject', xmpSubject]);

    if (rows.length === 0) return '';

    return html`
      <tr class="metadata-row exif-section">
        <td class="metadata-label">EXIF Data</td>
        <td class="metadata-value"></td>
      </tr>
      ${rows.map(([label, value]) => html`
        <tr class="metadata-row exif-row">
          <td class="metadata-label">${label}</td>
          <td class="metadata-value">${value}</td>
        </tr>
      `)}
    `;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / (k ** i)) * 100) / 100} ${sizes[i]}`;
  }

  renderModalPreview() {
    const { media } = this.modalData.data;

    if (this.isImage(media.url)) {
      const ext = this.getFileExtension(media.url).toUpperCase();
      return html`
        <div class="image-preview-container">
          <img 
            class="media-preview" 
            src=${media.url} 
            alt=${media.alt !== null ? media.alt : ''}
            @error=${(e) => this.handleImageError(e, media)}
          />
          ${ext ? html`<div class="subtype-label">${ext}</div>` : ''}
        </div>
      `;
    }

    if (this.isVideo(media.url)) {
      return this.renderVideoPreview(media);
    }

    if (this.isPdf(media.url)) {
      return html`
        <div class="pdf-preview">
          <div class="pdf-preview-header">
            <svg class="pdf-icon">
              <use href="#pdf"></use>
            </svg>
            <h3>PDF Document</h3>
            <p>${media.name}</p>
          </div>
          <div class="pdf-actions">
            <button 
              class="pdf-action-btn" 
              @click=${(e) => this.handlePdfAction(e, media.url, media.name)}
              title="Click to view PDF, Ctrl/Cmd+Click to download"
            >
              <svg class="action-icon">
                <use href="#external-link"></use>
              </svg>
              Open PDF
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="preview-placeholder">
        <svg class="preview-icon">
          <use href="#${this.getMediaTypeIcon(media)}"></use>
        </svg>
      </div>
    `;
  }

  renderVideoPreview(media) {
    const ext = this.getFileExtension(media.url).toUpperCase();

    // Check if it's an external video URL (YouTube, Vimeo, etc.)
    if (isExternalVideoUrl(media.url)) {
      const thumbnail = getVideoThumbnail(media.url);
      return html`
        <div class="external-video-preview">
          <div class="video-thumbnail-container">
            ${thumbnail ? html`
              <img 
                class="video-thumbnail" 
                src=${thumbnail} 
                alt=${media.alt !== null ? media.alt : ''}
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
              <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="64" height="64">
                <path fill="#fff" d="M6.3 3.2C5.6 2.8 5 3.3 5 4.1v11.8c0 0.8 0.6 1.3 1.3 0.9l9.4-5.9c0.6-0.4 0.6-1.4 0-1.8L6.3 3.2z"/>
              </svg>
            </div>
            ${ext ? html`<div class="subtype-label">${ext}</div>` : ''}
          </div>
          <div class="video-info">
            <h3>External Video</h3>
            <p>${media.name}</p>
            <button 
              class="video-action-btn" 
              @click=${(e) => this.handleExternalVideoAction(e, media.url, media.name)}
              title="Click to open video, Ctrl/Cmd+Click to open in new tab"
            >
              <svg class="action-icon">
                <use href="#external-link"></use>
              </svg>
              Open Video
            </button>
          </div>
        </div>
      `;
    }

    // Regular video file
    return html`
      <div class="video-preview-container">
        <video 
          class="media-preview video-preview" 
          src=${media.url} 
          controls
          preload="metadata"
          @error=${(e) => this.handleVideoError(e, media)}
        >
          <p>Your browser does not support the video tag.</p>
        </video>
        ${ext ? html`<div class="subtype-label">${ext}</div>` : ''}
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

  handleExternalVideoAction(e, url) {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Open in current tab
      window.open(url, '_self');
    }
  }

  getModalTitle() {
    const { data } = this.modalData;
    return data?.media?.name || 'Media Details';
  }

  getMediaOriginFilename() {
    const { data } = this.modalData;
    const media = data?.media;
    if (!media?.url) return 'Unknown';
    try {
      const url = new URL(media.url);
      // Extract domain from origin (e.g., "https://www.sling.com" -> "www.sling.com")
      const originParts = url.origin.split('/');
      return originParts[originParts.length - 1] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  getMediaTypeIcon(media) {
    const type = media.type || '';
    if (type.startsWith('img >')) return 'photo';
    if (type.startsWith('video >')) return 'video';
    if (type.startsWith('document >')) return 'pdf';
    if (type.startsWith('link >')) return 'external-link';

    if (this.isPdf(media.url)) return 'pdf';
    if (this.isImage(media.url)) return 'photo';
    if (this.isVideo(media.url)) return 'video';

    return 'photo';
  }

  isImage(url) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
    const ext = this.getFileExtension(url);
    return imageExtensions.includes(ext);
  }

  isVideo(url) {
    const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
    const ext = this.getFileExtension(url);
    return videoExtensions.includes(ext);
  }

  isPdf(url) {
    const ext = this.getFileExtension(url);
    return ext === 'pdf';
  }

  getFileExtension(url) {
    if (!url) return '';

    try {
      const cleanUrl = url.split(/[?#]/)[0];
      const extension = cleanUrl.split('.').pop()?.toLowerCase() || '';

      if (!extension || extension === cleanUrl || /[^a-z0-9]/.test(extension)) {
        return '';
      }

      return extension;
    } catch (error) {
      return '';
    }
  }

  handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      this.handleCloseModal();
    }
  }

  handleContentClick(e) {
    e.stopPropagation();
  }

  handleCopy() {
    const { media } = this.modalData.data;
    navigator.clipboard.writeText(media.url);

    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: {
        heading: this.t('common.success'),
        message: this.t('media.copyUrl'),
        type: 'success',
      },
    }));
  }

  handleViewDocument(docPath) {
    if (!docPath) return;
    window.open(docPath, '_blank', 'noopener,noreferrer');
  }

  handleViewMedia(mediaUrl) {
    if (!mediaUrl) return;
    window.open(mediaUrl, '_blank', 'noopener,noreferrer');
  }

  async handleGetAISuggestion(pageUrl, occurrenceIndex, usageHash) {
    if (!this.aiEnabled || !this.aiWorkerUrl) return;

    // Validate siteKey before making AI calls
    if (!this.siteKey) {
      // eslint-disable-next-line no-console
      console.error('[Media Details] ❌ BLOCKED: No siteKey available - cannot get AI suggestion');
      this._aiSuggestions = {
        ...this._aiSuggestions,
        [usageHash]: {
          error: 'Please scan a website first. AI analysis requires site data.',
          suggestedAlt: null,
        },
      };
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[Media Details] 🎨 Requesting AI alt text suggestion for siteKey:', this.siteKey);
    // eslint-disable-next-line no-console
    console.log('[Media Details] 📍 Page:', pageUrl, 'Occurrence:', occurrenceIndex);

    this._loadingSuggestion = usageHash;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.aiApiKey) {
        headers['X-API-Key'] = this.aiApiKey;
      }

      const response = await fetch(`${this.aiWorkerUrl}/api/ai/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageUrl: this.modalData.data.media.url,
          pageUrl,
          occurrence: occurrenceIndex,
          siteKey: this.siteKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.status}`);
      }

      const suggestion = await response.json();

      this._aiSuggestions = {
        ...this._aiSuggestions,
        [usageHash]: suggestion,
      };
    } catch (error) {
      this._aiSuggestions = {
        ...this._aiSuggestions,
        [usageHash]: { error: error.message, suggestedAlt: null },
      };
    } finally {
      this._loadingSuggestion = null;
    }
  }

  renderAISuggestion(suggestion) {
    if (suggestion.error) {
      return html`<div class="ai-suggestion error"><p class="error-message">Failed: ${suggestion.error}</p></div>`;
    }

    const { suggestedAlt, reasoning, impact } = suggestion;

    return html`
      <div class="ai-suggestion">
        <div class="suggestion-header">
          <svg class="ai-icon" width="16" height="16"><use href="#sparkle"></use></svg>
          <span>AI Recommendation</span>
        </div>
        <div class="suggested-alt"><strong>Suggested:</strong> "${suggestedAlt || '(empty)'}"</div>
        ${reasoning ? html`<div class="reasoning"><strong>Why:</strong> ${reasoning}</div>` : ''}
        ${impact ? html`
          <div class="impact-scores">
            <div class="score-group">
              <span>A11y: ${impact.current.a11y} → ${impact.suggested.a11y} 
                ${impact.improvement.a11y > 0 ? `(+${impact.improvement.a11y})` : ''}
              </span>
            </div>
            <div class="score-group">
              <span>SEO: ${impact.current.seo} → ${impact.suggested.seo} 
                ${impact.improvement.seo > 0 ? `(+${impact.improvement.seo})` : ''}
              </span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  handlePdfAction(event, pdfUrl, fileName) {
    if (!pdfUrl) return;

    const isDownload = event.ctrlKey || event.metaKey;

    if (isDownload) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName || 'document.pdf';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(pdfUrl, '_blank');
    }
  }
}

customElements.define('media-details', MediaDetails);
