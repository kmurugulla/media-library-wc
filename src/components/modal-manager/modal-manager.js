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
    _activeTab: { state: true },
    _expandedUsages: { state: true }
  };

  static styles = getStyles(modalManagerStyles);

  constructor() {
    super();
    this.locale = 'en';
    this.isOpen = false;
    this.modalData = null;
    this._activeTab = 'usage';
    this._expandedUsages = new Set();
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
      '/src/icons/copy.svg'
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

  handleTogglePerfTags = (usageId) => {
    if (this._expandedUsages.has(usageId)) {
      this._expandedUsages.delete(usageId);
    } else {
      this._expandedUsages.add(usageId);
    }
    this.requestUpdate();
  };
  
  getUsageCount() {
    if (!this.modalData?.data?.usageData) return 0;
    return this.modalData.data.usageData.length;
  }


  /**
   * Convert technical performance tags to user-friendly descriptions
   * @param {string} tag - The technical tag
   * @returns {string} User-friendly description
   */
  getFriendlyTagDescription(tag) {
    const descriptions = {
      'add-responsive-images': 'Add responsive images (srcset)',
      'convert-to-webp': 'Convert to WebP format',
      'add-loading-attribute': 'Add loading="lazy"',
      'resize-image': 'Resize large image',
      'critical-performance-issue': 'Critical performance issue',
      'lcp-candidate': 'Largest Contentful Paint candidate',
      'above-fold': 'Above the fold',
      'below-fold': 'Below the fold',
      'hero-section': 'Hero section',
      'lazy-loading': 'Lazy loading enabled',
      'eager-loading': 'Eager loading',
      'high-priority': 'High priority',
      'low-priority': 'Low priority',
      'has-srcset': 'Has responsive images',
      'no-srcset': 'No responsive images',
      'modern-format': 'Modern format (WebP/AVIF)',
      'legacy-format': 'Legacy format (JPG/PNG)',
      'fully-optimized': 'Fully optimized'
    };
    
    return descriptions[tag] || tag;
  }

  /**
   * Get user-friendly alt text display consistent with filters
   * @param {string} alt - The alt text value
   * @returns {string} User-friendly display text
   */
  getAltTextDisplay(alt) {
    if (!alt || alt === 'null') {
      return 'Missing Alt';
    }
    if (alt === '') {
      return 'Decorative';
    }
    return alt;
  }

  /**
   * Group performance tags into logical categories
   * @param {Array<string>} tags - Array of performance tags
   * @returns {Object} Grouped tags by category
   */
  groupPerformanceTags(tags) {
    const groups = {
      position: [],
      loading: [],
      responsive: [],
      format: [],
      optimization: [],
      other: []
    };

    tags.forEach(tag => {
      if (['above-fold', 'below-fold', 'hero-section', 'lcp-candidate', 'critical-content'].includes(tag)) {
        groups.position.push(tag);
      } else if (['no-loading-strategy', 'lazy-loading', 'eager-loading', 'high-priority', 'low-priority', 'add-loading-attribute'].includes(tag)) {
        groups.loading.push(tag);
      } else if (['no-srcset', 'has-srcset', 'no-sizes', 'has-sizes', 'responsive', 'fixed-size', 'multiple-sizes', 'add-responsive-images'].includes(tag)) {
        groups.responsive.push(tag);
      } else if (['legacy-format', 'modern-format', 'webp-available', 'avif-supported', 'convert-to-webp'].includes(tag)) {
        groups.format.push(tag);
      } else if (['large-size', 'optimized-size', 'resize-image', 'needs-optimization', 'fully-optimized', 'critical-performance-issue'].includes(tag)) {
        groups.optimization.push(tag);
      } else {
        groups.other.push(tag);
      }
    });

    return groups;
  }

  /**
   * Format grouped tags with hierarchical structure
   * @param {Object} groups - Grouped tags object
   * @returns {string} Formatted string with groups and sub-bullets
   */
  formatGroupedTags(groups) {
    const sections = [];

    if (groups.position.length > 0) {
      const positionText = groups.position.map(tag => this.getFriendlyTagDescription(tag)).join(', ');
      sections.push(`**Position:** ${positionText}`);
    }

    if (groups.loading.length > 0) {
      const issues = groups.loading.filter(tag => ['no-loading-strategy'].includes(tag));
      const recommendations = groups.loading.filter(tag => ['add-loading-attribute'].includes(tag));
      const status = groups.loading.filter(tag => ['lazy-loading', 'eager-loading', 'high-priority', 'low-priority'].includes(tag));
      
      if (issues.length > 0) {
        sections.push(`**Loading Strategy:** ${issues.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        if (recommendations.length > 0) {
          sections.push(`  ↳ **Recommendation:** ${recommendations.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        }
      }
      if (status.length > 0) {
        sections.push(`**Loading Status:** ${status.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
      }
    }

    if (groups.responsive.length > 0) {
      const issues = groups.responsive.filter(tag => ['no-srcset', 'no-sizes', 'fixed-size'].includes(tag));
      const recommendations = groups.responsive.filter(tag => ['add-responsive-images'].includes(tag));
      const status = groups.responsive.filter(tag => ['has-srcset', 'has-sizes', 'responsive', 'multiple-sizes'].includes(tag));
      
      if (issues.length > 0) {
        sections.push(`**Responsive Images:** ${issues.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        if (recommendations.length > 0) {
          sections.push(`  ↳ **Recommendation:** ${recommendations.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        }
      }
      if (status.length > 0) {
        sections.push(`**Responsive Status:** ${status.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
      }
    }

    if (groups.format.length > 0) {
      const issues = groups.format.filter(tag => ['legacy-format'].includes(tag));
      const recommendations = groups.format.filter(tag => ['convert-to-webp'].includes(tag));
      const status = groups.format.filter(tag => ['modern-format', 'webp-available', 'avif-supported'].includes(tag));
      
      if (issues.length > 0) {
        sections.push(`**Image Format:** ${issues.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        if (recommendations.length > 0) {
          sections.push(`  ↳ **Recommendation:** ${recommendations.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        }
      }
      if (status.length > 0) {
        sections.push(`**Format Status:** ${status.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
      }
    }

    if (groups.optimization.length > 0) {
      const issues = groups.optimization.filter(tag => ['large-size', 'needs-optimization', 'critical-performance-issue'].includes(tag));
      const recommendations = groups.optimization.filter(tag => ['resize-image'].includes(tag));
      const status = groups.optimization.filter(tag => ['optimized-size', 'fully-optimized'].includes(tag));
      
      if (issues.length > 0) {
        sections.push(`**Optimization:** ${issues.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        if (recommendations.length > 0) {
          sections.push(`  ↳ **Recommendation:** ${recommendations.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
        }
      }
      if (status.length > 0) {
        sections.push(`**Optimization Status:** ${status.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
      }
    }

    if (groups.other.length > 0) {
      sections.push(`**Other:** ${groups.other.map(tag => this.getFriendlyTagDescription(tag)).join(', ')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'No performance data';
  }

  /**
   * Format context as HTML with proper bold formatting
   * @param {string} context - The context string to format
   * @param {boolean} showAllPerfTags - Whether to show all performance tags
   * @returns {TemplateResult} HTML template with formatting
   */
  formatContextAsHtml(context, showAllPerfTags = false) {
    if (!context) return html`<span>No context</span>`;
    
    // Split by the main delimiter and format each part
    const parts = context.split(' > ');
    const formattedParts = parts.map(part => {
      if (part.startsWith('perf:')) {
        // Format performance tags with HTML
        const perfTags = part.replace('perf:', '').split(',');
        
        if (showAllPerfTags) {
          const groupedTags = this.groupPerformanceTags(perfTags);
          const formattedText = this.formatGroupedTags(groupedTags);
          return this.convertMarkdownToHtml(formattedText);
        } else {
          const criticalTags = perfTags.filter(tag => 
            ['critical-performance-issue', 'add-responsive-images', 'convert-to-webp', 'add-loading-attribute', 'resize-image', 'lcp-candidate', 'above-fold', 'hero-section', 'below-fold'].includes(tag)
          );
          
          if (criticalTags.length > 0) {
            const remainingCount = perfTags.length - criticalTags.length;
            const friendlyTags = criticalTags.map(tag => this.getFriendlyTagDescription(tag));
            const summary = `Performance: ${friendlyTags.join(', ')}`;
            return html`<span>${remainingCount > 0 ? `${summary} (+${remainingCount} more)` : summary}</span>`;
          } else {
            const actionableTags = perfTags.filter(tag => 
              ['add-responsive-images', 'convert-to-webp', 'add-loading-attribute', 'resize-image'].includes(tag)
            );
            
            if (actionableTags.length > 0) {
              const friendlyTags = actionableTags.map(tag => this.getFriendlyTagDescription(tag));
              const remainingCount = perfTags.length - actionableTags.length;
              const summary = `Performance: ${friendlyTags.join(', ')}`;
              return html`<span>${remainingCount > 0 ? `${summary} (+${remainingCount} more)` : summary}</span>`;
            } else {
              const remainingCount = perfTags.length;
              return html`<span>${remainingCount > 0 ? `Performance: ${remainingCount} tags` : 'Performance: No issues'}</span>`;
            }
          }
        }
      } else if (part.startsWith('In div:')) {
        return html`<span><strong>Container:</strong> ${part.replace('In div:', '').trim()}</span>`;
      } else if (part.startsWith('text:')) {
        return html`<span><strong>Text:</strong> ${part.replace('text:', '').trim()}</span>`;
      } else {
        return html`<span><strong>Type:</strong> ${part}</span>`;
      }
    });
    
    return html`<div>${formattedParts.map(part => html`<div>${part}</div>`)}</div>`;
  }

  /**
   * Convert markdown-style bold text to HTML
   * @param {string} text - Text with **bold** markers
   * @returns {TemplateResult} HTML with bold formatting
   */
  convertMarkdownToHtml(text) {
    const lines = text.split('\n');
    return html`<div>${lines.map(line => {
      if (line.trim() === '') return html`<br>`;
      
      // Split by ** markers and create proper HTML structure
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return html`<div>${parts.map(part => {
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
                    <th>Alt Text</th>
                    <th>Context</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages.map((usage, index) => {
                    const usageId = `${doc}-${index}`;
                    const isExpanded = this._expandedUsages.has(usageId);
                    return html`
                    <tr class="usage-row">
                      <td class="alt-cell">
                        <div class="alt-text">${this.getAltTextDisplay(usage.alt)}</div>
                      </td>
                      <td class="context-cell">
                        <div class="context-text">${this.formatContextAsHtml(usage.ctx, isExpanded)}</div>
                        ${usage.ctx && usage.ctx.includes('perf:') ? html`
                          <button class="perf-toggle-btn" @click=${() => this.handleTogglePerfTags(usageId)}>
                            ${isExpanded ? 'Show Less' : 'Show All Performance Tags'}
                          </button>
                        ` : ''}
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
              <tr class="metadata-row">
                <td class="metadata-label">Usage Count</td>
                <td class="metadata-value">${media.usageCount || 0}</td>
              </tr>
              
              ${this.renderAnalysisMetadata(media)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderAnalysisMetadata(media) {
    const hasAnalysisData = media.orientation || media.category || media.width || media.height || 
                           media.exifCamera || media.exifDate || media.hasFaces || media.dominantColor;
    
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
        <td class="metadata-value">—</td>
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
          <td class="metadata-value">${media.width} × ${media.height}px</td>
        </tr>
      ` : ''}
      ${this.renderCameraInfo(media)}
      ${media.exifDate ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Date Taken</td>
          <td class="metadata-value">${media.exifDate}</td>
        </tr>
      ` : ''}
      ${this.renderFaceDetection(media)}
      ${media.dominantColor && media.dominantColor !== 'undefined' ? html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Dominant Color</td>
          <td class="metadata-value">
            <div class="color-preview">
              <span class="color-swatch" style="background-color: ${media.dominantColor}"></span>
              ${media.dominantColor}
            </div>
          </td>
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

  renderFaceDetection(media) {
    if (media.hasFaces !== undefined && media.hasFaces !== 'undefined') {
      return html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Faces Detected</td>
          <td class="metadata-value">${media.hasFaces ? `Yes (${media.faceCount || 1})` : 'No'}</td>
        </tr>
      `;
    }
    
    if (media.faceCount && media.faceCount !== 'undefined' && media.faceCount > 0) {
      return html`
        <tr class="metadata-row analysis-subrow">
          <td class="metadata-label">Faces Detected</td>
          <td class="metadata-value">Yes (${media.faceCount})</td>
        </tr>
      `;
    }
    
    return '';
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
