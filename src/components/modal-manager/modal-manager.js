// src/components/modal-manager/modal-manager.js
import { html } from 'lit';
import { LocalizableElement } from '../base-localizable.js';
import getSvg from '../../utils/getSvg.js';
import { getStyles } from '../../utils/get-styles.js';
import modalManagerStyles from './modal-manager.css?inline';

class ModalManager extends LocalizableElement {
  static properties = {
    locale: { type: String },
    isOpen: { type: Boolean },
    modalData: { type: Object },
    _activeTab: { state: true }
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
    
    // Load SVG icons using Franklin approach
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
      '/src/icons/copy.svg'
    ];
    
    // Check if icons are already loaded to avoid duplicates
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
    // Close any other open modals first
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
    if (!this.modalData?.data?.usageData) return 0;
    return this.modalData.data.usageData.length;
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
    const { media, usageData } = this.modalData.data;
    
    if (!usageData || usageData.length === 0) {
      return html`
        <div class="no-usage">
          <p>Not Used</p>
        </div>
      `;
    }
    
    // Group usages by document
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
                    <th>Context</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages.map((usage) => html`
                    <tr class="usage-row">
                      <td class="context-cell">
                        <div class="context-text">${usage.ctx || 'No context'}</div>
                      </td>
                      <td class="actions-cell">
                        <div class="actions-container">
                          <button class="action-button" @click=${() => this.handleViewDocument(doc)}>
                            Preview
                          </button>
                          <button class="action-button" @click=${() => this.handleEditDocument(doc)}>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  `)}
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
                <td class="metadata-label">Alt Text</td>
                <td class="metadata-value">${media.alt || '—'}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">Type</td>
                <td class="metadata-value">${media.type}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">Context</td>
                <td class="metadata-value">${media.ctx || '—'}</td>
              </tr>
              <tr class="metadata-row">
                <td class="metadata-label">Usage Count</td>
                <td class="metadata-value">${media.usageCount || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
    // Mark the media item as having an error
    media.hasError = true;
    
    // Hide the image and trigger a re-render
    e.target.style.display = 'none';
    
    // Request an update to re-render with the error state
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
    
    // Check by file extension
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
      // Remove query parameters and fragments using regex (more robust)
      const cleanUrl = url.split(/[?#]/)[0];
      
      // Extract the file extension
      const extension = cleanUrl.split('.').pop()?.toLowerCase() || '';
      
      // Validate the extension - ensure it's not empty and different from the entire URL
      // Also check it doesn't contain invalid characters (like spaces, slashes, etc.)
      if (!extension || extension === cleanUrl || /[^a-z0-9]/.test(extension)) {
        return '';
      }
      
      return extension;
    } catch (error) {
      console.warn('Error extracting file extension from URL:', url, error);
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
      data: this.modalData.data
    };
  }

  handleCopy() {
    const { media } = this.modalData.data;
    navigator.clipboard.writeText(media.url);
    
    // Show notification
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: {
        heading: this.t('common.success'),
        message: this.t('media.copyUrl'),
        type: 'success'
      }
    }));
  }
  
  handleViewDocument(docPath) {
    if (!docPath) return;
    // Open document in new tab
    window.open(docPath, '_blank');
  }
  
  handleEditDocument(docPath) {
    if (!docPath) return;
    // For now, just open the document - in a real implementation, this would open an editor
    window.open(docPath, '_blank');
  }

  handlePdfAction(event, pdfUrl, fileName) {
    if (!pdfUrl) return;
    
    // Check if the user wants to download (Ctrl/Cmd + click) or just view
    const isDownload = event.ctrlKey || event.metaKey;
    
    if (isDownload) {
      // Force download by creating a link with download attribute
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName || 'document.pdf';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Open PDF in new tab for viewing
      window.open(pdfUrl, '_blank');
    }
  }

  handleSave(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const altText = formData.get('altText');
    
    // Dispatch save event
    window.dispatchEvent(new CustomEvent('save-alt-text', {
      detail: {
        media: this.modalData.data.media,
        altText
      }
    }));
    
    this.handleCloseModal();
  }

  handleFormSubmit(e) {
    e.preventDefault();
    this.handleSave(e);
  }
}

customElements.define('modal-manager', ModalManager);
