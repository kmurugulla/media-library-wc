import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import { getStyles } from '../../utils/get-styles.js';
import { getCategoryFilters } from '../../utils/filters.js';
import sidebarStyles from './sidebar.css?inline';

class MediaSidebar extends LocalizableElement {
  static properties = {
    activeFilter: { type: String },
    filterCounts: { type: Object },
    locale: { type: String },
  };

  static styles = getStyles(sidebarStyles);

  constructor() {
    super();
    this.activeFilter = 'all';
    this.filterCounts = {};
    this.locale = 'en';
  }

  async connectedCallback() {
    super.connectedCallback();
    this.handleClearFilters = this.handleClearFilters.bind(this);
    window.addEventListener('clear-filters', this.handleClearFilters);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('clear-filters', this.handleClearFilters);
  }

  handleClearFilters() {
    this.activeFilter = 'all';
    this.requestUpdate();
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
            ${this.renderFilterItem('icons', counts.icons, 'SVGs')}
            ${this.renderFilterItem('unused', counts.unused)}
          </ul>
        </div>

        ${(counts.filled > 0 || counts.decorative > 0 || counts.missingAlt > 0) ? html`
          <div class="filter-section">
            <h3>Accessibility</h3>
            <ul class="filter-list">
              ${this.renderFilterItem('filled', counts.filled)}
              ${this.renderFilterItem('decorative', counts.decorative)}
              ${this.renderFilterItem('missingAlt', counts.missingAlt, 'No Alt Text')}
            </ul>
          </div>
        ` : ''}

        ${(counts.landscape > 0 || counts.portrait > 0 || counts.square > 0) ? html`
          <div class="filter-section">
            <h3>Orientation</h3>
            <ul class="filter-list">
              ${this.renderFilterItem('landscape', counts.landscape)}
              ${this.renderFilterItem('portrait', counts.portrait)}
              ${this.renderFilterItem('square', counts.square)}
            </ul>
          </div>
        ` : ''}

        ${this.renderCategorySection(counts)}
      </aside>
    `;
  }

  renderFilterItem(filterType, count, customLabel = null) {
    if (!count || count === 0) return '';

    const label = customLabel || this.t(`filters.${filterType}`);
    const categoryFilters = getCategoryFilters();
    const isCategoryFilter = categoryFilters.includes(filterType);

    return html`
      <li class="filter-item">
        <button 
          class="filter-button ${this.activeFilter === filterType ? 'active' : ''}"
          @click=${() => this.handleFilter(filterType)}
          aria-pressed=${this.activeFilter === filterType}
          data-category=${isCategoryFilter ? filterType : ''}
        >
          <span>${label}</span>
          <span class="count">${this.formatNumber(count)}</span>
        </button>
      </li>
    `;
  }

  renderCategorySection(counts) {
    const categoryFilters = getCategoryFilters();
    const hasCategoryItems = categoryFilters.some((category) => counts[category] > 0);

    if (!hasCategoryItems) return '';

    return html`
      <div class="filter-section">
        <h3>${this.t('categories.title')}</h3>
        <ul class="filter-list">
          ${categoryFilters.map((category) => this.renderFilterItem(category, counts[category]))}
        </ul>
      </div>
    `;
  }

  handleFilter(filterType) {
    this.dispatchEvent(new CustomEvent('filter', { detail: { type: filterType } }));
  }
}

customElements.define('media-sidebar', MediaSidebar);
