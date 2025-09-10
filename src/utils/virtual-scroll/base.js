// src/utils/virtual-scroll-base.js
export const SCROLL_CONSTANTS = {
  GRID_ITEM_WIDTH: 410,
  GRID_ITEM_HEIGHT: 400,
  GRID_CARD_SPACING: 20,

  LIST_ITEM_HEIGHT: 80,

  BUFFER_SIZE: 5,
  SCROLL_THROTTLE: 16,
  MAX_VISIBLE_ITEMS: 50,
};

/**
 * Virtual scroll manager for handling scroll-based rendering
 */
export class VirtualScrollManager {
  /**
   * Calculate responsive item width based on viewport
   */
  getResponsiveItemWidth() {
    if (typeof window === 'undefined') return SCROLL_CONSTANTS.GRID_ITEM_WIDTH;

    const width = window.innerWidth;

    if (width >= 1200) {
      return 410;
    } if (width >= 992) {
      return 360;
    } if (width >= 768) {
      return 310;
    } if (width >= 576) {
      return 290;
    }
    return 260;
  }

  constructor(options = {}) {
    this.container = null;
    this.scrollListenerAttached = false;
    this.scrollTimeout = null;
    this.throttledScroll = null;

    this.itemHeight = options.itemHeight || SCROLL_CONSTANTS.GRID_ITEM_HEIGHT;
    this.itemWidth = options.itemWidth || this.getResponsiveItemWidth();
    this.cardSpacing = options.cardSpacing || SCROLL_CONSTANTS.GRID_CARD_SPACING;
    this.bufferSize = options.bufferSize || SCROLL_CONSTANTS.BUFFER_SIZE;
    this.maxVisibleItems = options.maxVisibleItems || SCROLL_CONSTANTS.MAX_VISIBLE_ITEMS;
    this.scrollThrottle = options.scrollThrottle || SCROLL_CONSTANTS.SCROLL_THROTTLE;

    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.totalItems = 0;
    this.containerHeight = 0;
    this.containerWidth = 0;

    this.onRangeChange = options.onRangeChange || null;
    this.onColCountChange = options.onColCountChange || null;

    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /**
   * Initialize the virtual scroll manager
   * @param {HTMLElement} container - The scrollable container
   * @param {number} totalItems - Total number of items
   */
  init(container, totalItems) {
    this.container = container;
    this.totalItems = totalItems;

    this.updateContainerDimensions();
    this.calculateVisibleRange();
    this.attachScrollListener();
    this.attachResizeListener();
  }

  /**
   * Update container dimensions
   */
  updateContainerDimensions() {
    if (!this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.containerHeight = rect.height;
    this.containerWidth = rect.width;
  }

  /**
   * Calculate which items should be visible
   */
  calculateVisibleRange() {
    if (!this.container || this.totalItems === 0) {
      this.visibleStart = 0;
      this.visibleEnd = 0;
      return;
    }

    const { scrollTop } = this.container;
    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const startRow = Math.floor(scrollTop / (this.itemHeight + this.cardSpacing));
    const endRow = Math.ceil(
      (scrollTop + this.containerHeight) / (this.itemHeight + this.cardSpacing),
    );

    this.visibleStart = Math.max(0, startRow * itemsPerRow - this.bufferSize);
    this.visibleEnd = Math.min(this.totalItems, (endRow + 1) * itemsPerRow + this.bufferSize);

    if (this.visibleEnd - this.visibleStart > this.maxVisibleItems) {
      const center = Math.floor((this.visibleStart + this.visibleEnd) / 2);
      this.visibleStart = Math.max(0, center - Math.floor(this.maxVisibleItems / 2));
      this.visibleEnd = Math.min(this.totalItems, this.visibleStart + this.maxVisibleItems);
    }
  }

  /**
   * Handle scroll events
   */
  onScroll() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      this.calculateVisibleRange();
      this.onVisibleRangeChange();
    }, this.scrollThrottle);
  }

  /**
   * Handle resize events
   */
  onResize() {
    this.updateContainerDimensions();
    this.itemWidth = this.getResponsiveItemWidth();
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

  /**
   * Called when visible range changes - should be overridden by subclasses
   */
  onVisibleRangeChange() {
    if (this.onRangeChange) {
      this.onRangeChange({
        start: this.visibleStart,
        end: this.visibleEnd,
      });
    }
  }

  /**
   * Attach scroll listener
   */
  attachScrollListener() {
    if (this.scrollListenerAttached || !this.container) return;

    this.container.addEventListener('scroll', this.onScroll, { passive: true });
    this.scrollListenerAttached = true;
  }

  /**
   * Detach scroll listener
   */
  detachScrollListener() {
    if (!this.scrollListenerAttached || !this.container) return;

    this.container.removeEventListener('scroll', this.onScroll);
    this.scrollListenerAttached = false;
  }

  /**
   * Attach resize listener
   */
  attachResizeListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', this.onResize, { passive: true });
  }

  /**
   * Detach resize listener
   */
  detachResizeListener() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Update total items count
   * @param {number} totalItems - New total items count
   */
  updateTotalItems(totalItems) {
    this.totalItems = totalItems;
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

  /**
   * Reset the virtual scroll state with new total items
   * @param {number} totalItems - New total items count
   */
  resetState(totalItems) {
    this.totalItems = totalItems;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

  /**
   * Update column count (for grid layouts)
   */
  updateColCount() {
    this.updateContainerDimensions();
    this.itemWidth = this.getResponsiveItemWidth();
    this.calculateVisibleRange();
    this.onVisibleRangeChange();

    if (this.onColCountChange) {
      const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
      this.onColCountChange(itemsPerRow);
    }
  }

  /**
   * Calculate total height needed for all items
   * @param {number} totalItems - Total number of items
   * @returns {number} Total height in pixels
   */
  calculateTotalHeight(totalItems) {
    if (totalItems === 0) return 0;

    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const totalRows = Math.ceil(totalItems / itemsPerRow);
    return totalRows * (this.itemHeight + this.cardSpacing);
  }

  /**
   * Calculate position for a specific item in the grid
   * @param {number} index - Item index
   * @returns {Object} Object with top and left positions
   */
  calculateItemPosition(index) {
    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;

    return {
      top: row * (this.itemHeight + this.cardSpacing),
      left: col * (this.itemWidth + this.cardSpacing),
    };
  }

  /**
   * Setup scroll listener (alias for attachScrollListener)
   * @param {HTMLElement} container - The scrollable container
   */
  setupScrollListener(container) {
    this.container = container;
    this.updateContainerDimensions();
    this.calculateVisibleRange();
    this.attachScrollListener();
    this.attachResizeListener();
  }

  /**
   * Clean up resources (alias for destroy)
   */
  cleanup() {
    this.destroy();
  }

  /**
   * Get total items count
   * @returns {number} Total number of items
   */
  getTotalItems() {
    return this.totalItems;
  }

  /**
   * Get current visible range
   * @returns {Object} Object with start and end indices
   */
  getVisibleRange() {
    return {
      start: this.visibleStart,
      end: this.visibleEnd,
    };
  }

  /**
   * Get visible items from data array
   * @param {Array} data - Full data array
   * @returns {Array} Visible items slice
   */
  getVisibleItems(data) {
    if (!data || data.length === 0) return [];
    return data.slice(this.visibleStart, this.visibleEnd);
  }

  /**
   * Scroll to specific item
   * @param {number} index - Item index to scroll to
   */
  scrollToItem(index) {
    if (!this.container || index < 0 || index >= this.totalItems) return;

    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const row = Math.floor(index / itemsPerRow);
    const scrollTop = row * (this.itemHeight + this.cardSpacing);

    this.container.scrollTop = scrollTop;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.detachScrollListener();
    this.detachResizeListener();

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    this.container = null;
    this.totalItems = 0;
  }
}
