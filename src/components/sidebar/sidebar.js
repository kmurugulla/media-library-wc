import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import { getStyles } from '../../utils/get-styles.js';
import { getCategoryFilters } from '../../utils/filters.js';
import logger from '../../utils/logger.js';
import getSvg from '../../utils/get-svg.js';
import sidebarStyles from './sidebar.css?inline';

class MediaSidebar extends LocalizableElement {
  static properties = {
    activeFilter: { type: String },
    filterCounts: { type: Object },
    locale: { type: String },
    isScanning: { type: Boolean },
    scanProgress: { type: Object },
    isExpanded: { type: Boolean, state: true },
    isIndexExpanded: { type: Boolean, state: true },
  };

  static styles = getStyles(sidebarStyles);

  constructor() {
    super();
    this.activeFilter = 'all';
    this.filterCounts = {};
    this.locale = 'en';
    this.isScanning = false;
    this.scanProgress = { pages: 0, media: 0, duration: null, hasChanges: null };
    this.isExpanded = false;
    this.isIndexExpanded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.handleClearFilters = this.handleClearFilters.bind(this);
    window.addEventListener('clear-filters', this.handleClearFilters);
  }

  async firstUpdated() {
    // Load icons after first render when shadowRoot is fully ready
    const ICONS = [
      'deps/icons/filter.svg',
      'deps/icons/refresh.svg',
    ];

    await getSvg({ parent: this.shadowRoot, paths: ICONS });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('clear-filters', this.handleClearFilters);
  }

  handleClearFilters() {
    this.activeFilter = 'all';
    this.requestUpdate();
  }

  handleToggle() {
    if (this.isIndexExpanded) {
      this.isIndexExpanded = false;
    }
    this.isExpanded = !this.isExpanded;
    this.dispatchEvent(new CustomEvent('sidebarToggle', {
      detail: { expanded: this.isExpanded },
      bubbles: true,
      composed: true,
    }));
  }

  handleIndexToggle() {
    if (this.isExpanded) {
      this.isExpanded = false;
    }
    this.isIndexExpanded = !this.isIndexExpanded;
  }

  renderIconButton(iconRef, label, isActive = false, customHandler = null) {
    const handler = customHandler || this.handleToggle.bind(this);
    return html`
      <button
        class="icon-btn ${isActive ? 'active' : ''}"
        @click=${handler}
        title=${label}
        aria-label=${label}
        aria-expanded=${isActive}
      >
        <svg class="icon">
          <use href="#${iconRef}"></use>
        </svg>
        ${this.isExpanded || this.isIndexExpanded ? html`<span class="icon-label">${label}</span>` : ''}
      </button>
    `;
  }

  renderIndexPanel() {
    if (this.isScanning) {
      return html`
        <div class="index-panel">
          <div class="index-message">
            ${this.scanProgress?.pages || 0} pages, ${this.scanProgress?.media || 0} media
          </div>
        </div>
      `;
    }

    const hasCompletedScan = this.scanProgress?.duration
      || (!this.isScanning && (this.scanProgress?.pages > 0 || this.scanProgress?.media > 0));

    if (hasCompletedScan) {
      if (this.scanProgress.hasChanges === false) {
        return html`
          <div class="index-panel">
            <div class="index-message">
              No changes found
            </div>
          </div>
        `;
      }

      if (this.scanProgress.hasChanges === true) {
        return html`
          <div class="index-panel">
            <div class="index-message">
              Found ${this.scanProgress?.media || 0} media
            </div>
          </div>
        `;
      }

      return html`
        <div class="index-panel">
          <div class="index-message">
            Scan completed
          </div>
        </div>
      `;
    }

    return html`
      <div class="index-panel">
        <div class="index-message empty">
          Ready to index
        </div>
      </div>
    `;
  }

  render() {
    const counts = this.filterCounts || {};
    logger.debug('Sidebar render - filterCounts:', counts);
    logger.debug('Sidebar render - isScanning:', this.isScanning);
    logger.debug('Sidebar render - isExpanded:', this.isExpanded);
    logger.debug('Sidebar render - isIndexExpanded:', this.isIndexExpanded);

    return html`
      <aside class="media-sidebar ${this.isExpanded || this.isIndexExpanded ? 'expanded' : 'collapsed'}">
        <div class="sidebar-icons">
          ${this.renderIconButton('filter', this.t('common.filter'), this.isExpanded)}
        </div>

        ${this.isExpanded ? html`
          <div class="filter-panel">
            <div class="filter-section">
              <h3>Types</h3>
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

            ${(counts.filled > 0 || counts.decorative > 0 || counts.empty > 0) ? html`
              <div class="filter-section">
                <h3>Accessibility</h3>
                <ul class="filter-list">
                  ${this.renderFilterItem('filled', counts.filled)}
                  ${this.renderFilterItem('decorative', counts.decorative)}
                  ${this.renderFilterItem('empty', counts.empty)}
                </ul>
              </div>
            ` : ''}

            ${(this.isScanning || counts.landscape > 0 || counts.portrait > 0 || counts.square > 0) ? html`
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
          </div>
        ` : ''}

        <div class="sidebar-icons secondary">
          ${this.renderIconButton('refresh', 'Status', this.isIndexExpanded, this.handleIndexToggle.bind(this))}
        </div>

        ${this.isIndexExpanded ? this.renderIndexPanel() : ''}
      </aside>
    `;
  }

  renderFilterItem(filterType, count, customLabel = null) {
    const label = customLabel || this.t(`filters.${filterType}`);

    logger.debug(`renderFilterItem - ${filterType}: count=${count}, isScanning=${this.isScanning}`);

    // During scanning, show all filters but disabled and without counts
    if (this.isScanning) {
      return html`
        <li class="filter-item">
          <button 
            class="filter-button disabled"
            disabled
            aria-pressed="false"
          >
            <span>${label}</span>
          </button>
        </li>
      `;
    }

    // After scanning, only show filters with counts > 0
    if (!count || count === 0) {
      logger.debug(`Hiding filter ${filterType} - no count`);
      return '';
    }

    return html`
      <li class="filter-item">
        <button 
          class="filter-button ${this.activeFilter === filterType ? 'active' : ''}"
          @click=${() => this.handleFilter(filterType)}
          aria-pressed=${this.activeFilter === filterType}
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

    // During scanning, show category section even if no counts
    if (!this.isScanning && !hasCategoryItems) return '';

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
