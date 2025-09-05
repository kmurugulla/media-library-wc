// src/components/sidebar/sidebar.js
import { html } from 'lit';
import { LocalizableElement } from '../base-localizable.js';
import { getStyles } from '../../utils/get-styles.js';
import sidebarStyles from './sidebar.css?inline';

class MediaSidebar extends LocalizableElement {
  static properties = {
    activeFilter: { type: String },
    filterCounts: { type: Object },
    locale: { type: String }
  };

  static styles = getStyles(sidebarStyles);

  constructor() {
    super();
    this.activeFilter = 'all';
    this.filterCounts = {};
    this.locale = 'en';
  }

  render() {
    const counts = this.filterCounts || {};
    
    return html`
      <aside class="media-sidebar">
        <div class="sidebar-header">
          <h1 class="sidebar-title">${this.t('mediaLibrary.title')}</h1>
        </div>
        
        <div class="filter-section">
          <h3>${this.t('common.filter')}</h3>
          <ul class="filter-list">
            ${this.renderFilterItem('all', counts.all)}
            ${this.renderFilterItem('images', counts.images)}
            ${this.renderFilterItem('videos', counts.videos)}
            ${this.renderFilterItem('documents', counts.documents)}
            ${this.renderFilterItem('links', counts.links)}
            ${this.renderFilterItem('icons', counts.icons)}
            ${this.renderFilterItem('missingAlt', counts.missingAlt)}
            ${this.renderFilterItem('unused', counts.unused)}
          </ul>
        </div>
      </aside>
    `;
  }

  renderFilterItem(filterType, count) {
    if (!count || count === 0) return '';
    
    return html`
      <li class="filter-item">
        <button 
          class="filter-button ${this.activeFilter === filterType ? 'active' : ''}"
          @click=${() => this.handleFilter(filterType)}
          aria-pressed=${this.activeFilter === filterType}
        >
          <span>${this.t(`filters.${filterType}`)}</span>
          <span class="count">${this.formatNumber(count)}</span>
        </button>
      </li>
    `;
  }

  handleFilter(filterType) {
    this.dispatchEvent(new CustomEvent('filter', { 
      detail: { type: filterType } 
    }));
  }
}

customElements.define('media-sidebar', MediaSidebar);
