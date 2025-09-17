import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import getSvg from '../../utils/get-svg.js';
import { getStyles } from '../../utils/get-styles.js';
import modalManagerStyles from './modal-manager.css?inline';

class ModalManager extends LocalizableElement {
  static properties = {
    locale: { type: String },
    isOpen: { type: Boolean },
    modalData: { type: Object },
    _activeTab: { state: true },
  };

  static styles = getStyles(modalManagerStyles);

  constructor() {
    super();
    this.locale = 'en';
    this.isOpen = false;
    this.modalData = null;
    this._activeTab = 'usage';
  }

  async connectedCallback() {
    super.connectedCallback();

    await this.loadIcons();

    window.addEventListener('open-modal', this.handleOpenModal);
    window.addEventListener('close-modal', this.handleCloseModal);
  }

  async loadIcons() {
    const ICONS = [
      '/src/icons/close.svg',
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

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('open-modal', this.handleOpenModal);
    window.removeEventListener('close-modal', this.handleCloseModal);
  }

  handleOpenModal = (e) => {
    window.dispatchEvent(new Event('close-modal'));

    this.modalData = e.detail;
    this.isOpen = true;
  };

  handleCloseModal = () => {
    this.isOpen = false;
    this.modalData = null;
    this._activeTab = 'usage';
  };

  handleTabChange = (e) => {
    const { tab } = e.target.dataset;
    this._activeTab = tab;
  };

  getUsageCount() {
    const usageCount = this.modalData?.data?.media?.usageCount || 0;
    return usageCount;
  }

  shouldShowPreviewEditButtons() {
    const previewEditDomains = [
      'content.da.live',
    ];

    const source = this.modalData?.data?.source || '';

    return previewEditDomains.some((domain) => source.includes(domain));
  }

  getAltTextDisplay(alt) {
    if (!alt || alt === 'null') {
      return 'Missing Alt';
    }
    if (alt === '') {
      return 'Decorative';
    }
    return alt;
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
          <div class="modal-header">
            <h2 class="modal-title">${this.getModalTitle()}</h2>
            <button class="close-button" @click=${this.handleCloseModal} title="Close">
              <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="media-preview-section">
            ${this.renderModalPreview()}
          </div>
          
          <div class="modal-tabs">
            <button 
              type="button"
              class="tab-btn ${this._activeTab === 'usage' ? 'active' : ''}"
              data-tab="usage"
              @click=${this.handleTabChange}
            >
              Usage (${this.getUsageCount()})
            </button>
            <button 
              type="button"
              class="tab-btn ${this._activeTab === 'metadata' ? 'active' : ''}"
              data-tab="metadata"
              @click=${this.handleTabChange}
            >
              Metadata
            </button>
          </div>
          
          <div class="modal-body">
            ${this._activeTab === 'usage' ? this.renderUsageTab() : this.renderMetadataTab()}
          </div>
        </div>
      </div>
    `;
  }

  renderUsageTab() {
    const { usageData } = this.modalData.data;

    if (!usageData || usageData.length === 0) {
      return html`
        <div class="no-usage">
          <p>Not Used</p>
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
              <h3>${doc}</h3>
            </div>
            <div class="usage-table-container">
              <table class="usage-table">
                <thead>
                  <tr>
                    <th>Alt Text</th>
                    <th>Context</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages.map((usage) => {
    const shouldShowPreviewEdit = this.shouldShowPreviewEditButtons();
    return html`
                    <tr class="usage-row">
                      <td class="alt-cell">
                        <div class="alt-text">${this.getAltTextDisplay(usage.alt)}</div>
                      </td>
                      <td class="context-cell">
                        <div class="context-text">${this.formatContextAsHtml(usage.ctx)}</div>
                      </td>
                      <td class="actions-cell">
                        <div class="actions-container">
                          ${shouldShowPreviewEdit ? html`
                            <button class="action-button" @click=${() => this.handleViewDocument(doc)}>
                              Preview
                            </button>
                            <button class="action-button" @click=${() => this.handleEditDocument(doc)}>
                              Edit
                            </button>
                          ` : html`
                            <button class="action-button" @click=${() => this.handleViewDocument(doc)}>
                              Open
                            </button>
                          `}
                        </div>
                      </td>
                    </tr>
                    `;
  })}
                </tbody>
              </table>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  renderMetadataTab() {
    const { media } = this.modalData.data;

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
                <td class="metadata-label">File Name</td>
                <td class="metadata-value">${media.name}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">URL</td>
                <td class="metadata-value">${media.url}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">Type</td>
                <td class="metadata-value">${media.type}</td>
              </tr>
              
              ${this.renderAnalysisMetadata(media)}
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

  renderModalPreview() {
    const { media } = this.modalData.data;

    if (this.isImage(media.url)) {
      return html`
        <img 
          class="media-preview" 
          src=${media.url} 
          alt=${media.alt || media.name}
          @error=${(e) => this.handleImageError(e, media)}
        />
      `;
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

  handleImageError(e, media) {
    media.hasError = true;
    e.target.style.display = 'none';
    this.requestUpdate();
  }

  getModalTitle() {
    const { type, data } = this.modalData;

    switch (type) {
      case 'details':
        return data?.media?.name || 'Media Details';
      case 'edit':
        return this.t('media.editAltText');
      default:
        return 'Modal';
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

  handleEdit() {
    this.modalData = {
      type: 'edit',
      data: this.modalData.data,
    };
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
    window.open(docPath, '_blank');
  }

  handleEditDocument(docPath) {
    if (!docPath) return;
    window.open(docPath, '_blank');
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

  handleSave(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const altText = formData.get('altText');

    window.dispatchEvent(new CustomEvent('save-alt-text', {
      detail: {
        media: this.modalData.data.media,
        altText,
      },
    }));

    this.handleCloseModal();
  }

  handleFormSubmit(e) {
    e.preventDefault();
    this.handleSave(e);
  }
}

customElements.define('modal-manager', ModalManager);
