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
    const ICONS = [
      '/src/icons/close.svg',
      '/src/icons/photo.svg',
      '/src/icons/video.svg',
      '/src/icons/external-link.svg',
      '/src/icons/copy.svg'
    ];
    
    getSvg({ parent: this.shadowRoot, paths: ICONS });
    
    window.addEventListener('open-modal', this.handleOpenModal);
    window.addEventListener('close-modal', this.handleCloseModal);
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
        />
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
    if (type.startsWith('document >')) return 'external-link';
    if (type.startsWith('link >')) return 'external-link';
    return 'photo';
  }

  isImage(url) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
    const ext = url?.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(ext);
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
