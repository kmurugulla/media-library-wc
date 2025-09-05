// src/utils/virtual-scroll.js
// Reusable virtual scrolling utilities for grid and list views

// Virtual scroll constants
export const SCROLL_CONSTANTS = {
  // Grid constants - match original CSS grid behavior
  GRID_ITEM_WIDTH: 350, // Original card width
  GRID_ITEM_HEIGHT: 400, // Original card height
  GRID_CARD_SPACING: 20, // Gap between cards
  
  // List constants
  LIST_ITEM_HEIGHT: 80,
  
  // Virtual scroll constants
  BUFFER_SIZE: 5,
  SCROLL_THROTTLE: 16, // 60fps
  MAX_VISIBLE_ITEMS: 50,
};

/**
 * Virtual scroll manager for handling scroll-based rendering
 */
export class VirtualScrollManager {
  constructor(options = {}) {
    this.container = null;
    this.scrollListenerAttached = false;
    this.scrollTimeout = null;
    this.throttledScroll = null;
    
    // Configuration
    this.itemHeight = options.itemHeight || SCROLL_CONSTANTS.GRID_ITEM_HEIGHT;
    this.itemWidth = options.itemWidth || SCROLL_CONSTANTS.GRID_ITEM_WIDTH;
    this.cardSpacing = options.cardSpacing || SCROLL_CONSTANTS.GRID_CARD_SPACING;
    this.bufferSize = options.bufferSize || SCROLL_CONSTANTS.BUFFER_SIZE;
    this.maxVisibleItems = options.maxVisibleItems || SCROLL_CONSTANTS.MAX_VISIBLE_ITEMS;
    this.scrollThrottle = options.scrollThrottle || SCROLL_CONSTANTS.SCROLL_THROTTLE;
    
    // State
    this.visibleStart = 0;
    this.visibleEnd = this.maxVisibleItems;
    this.colCount = 1; // For grid layouts
    this.renderedItems = new Set();
    
    // Callbacks
    this.onRangeChange = options.onRangeChange || (() => {});
    this.onColCountChange = options.onColCountChange || (() => {});
  }

  /**
   * Setup scroll listener on the container
   */
  setupScrollListener(container) {
    if (!container) return;
    
    this.container = container;
    
    if (!this.scrollListenerAttached) {
      this.throttledScroll = this.throttleScroll(this.onScroll.bind(this));
      this.container.addEventListener('scroll', this.throttledScroll);
      this.scrollListenerAttached = true;
      
      // Initial calculation
      this.onScroll();
    }
  }

  /**
   * Clean up scroll listener
   */
  cleanup() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.container && this.scrollListenerAttached) {
      this.container.removeEventListener('scroll', this.throttledScroll);
      this.scrollListenerAttached = false;
    }
  }

  /**
   * Reset virtual scroll state
   */
  resetState(totalItems = 0) {
    this.visibleStart = 0;
    this.visibleEnd = Math.min(this.maxVisibleItems, totalItems);
    this.renderedItems.clear();
  }

  /**
   * Update column count for grid layouts
   */
  updateColCount() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    if (width === 0) return;

    // Account for padding in the container
    const availableWidth = width - 32; // 16px padding on each side
    const newColCount = Math.max(1, Math.floor(availableWidth / (this.itemWidth + this.cardSpacing)));
    if (newColCount !== this.colCount) {
      this.colCount = newColCount;
      this.onColCountChange(this.colCount);
    }
  }

  /**
   * Throttle scroll events for performance
   */
  throttleScroll(callback, delay = this.scrollThrottle) {
    let timeoutId;
    let lastCallTime = 0;
    
    return function throttled(...args) {
      const now = Date.now();
      
      // If enough time has passed, call immediately
      if (now - lastCallTime >= delay) {
        lastCallTime = now;
        callback.apply(this, args);
      } else {
        // Otherwise, schedule for later
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          lastCallTime = Date.now();
          callback.apply(this, args);
        }, delay - (now - lastCallTime));
      }
    };
  }

  /**
   * Handle scroll events
   */
  onScroll() {
    if (!this.container) return;

    const totalItems = this.getTotalItems();
    const range = this.calculateVisibleRange(
      this.container,
      this.itemHeight, // Use itemHeight directly for list (no cardSpacing)
      this.bufferSize,
      totalItems,
      this.colCount,
    );


    if (range.start !== this.visibleStart || range.end !== this.visibleEnd) {
      this.visibleStart = range.start;
      this.visibleEnd = range.end;
      this.onRangeChange({ start: this.visibleStart, end: this.visibleEnd });
    }
  }

  /**
   * Calculate visible range based on scroll position
   */
  calculateVisibleRange(container, itemHeight, bufferSize, totalItems, colCount = 1) {
    if (!container || !totalItems) return { start: 0, end: Math.min(this.maxVisibleItems, totalItems) };

    const { scrollTop } = container;
    const containerHeight = container.clientHeight;
    const scrollBottom = scrollTop + containerHeight;

    // For list layout (colCount = 1), calculate directly based on items
    if (colCount === 1) {
      const startItem = Math.floor(scrollTop / itemHeight);
      const endItem = Math.ceil(scrollBottom / itemHeight);
      
      const bufferStart = Math.max(0, startItem - bufferSize);
      const bufferEnd = Math.min(totalItems, endItem + bufferSize);
      
      // Ensure we always show at least some items
      const minEnd = Math.min(this.maxVisibleItems, totalItems);
      const finalEnd = Math.max(bufferEnd, minEnd);
      
      
      return { start: bufferStart, end: finalEnd };
    }

    // For grid layout, calculate based on rows
    const rowHeight = itemHeight;
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.ceil(scrollBottom / rowHeight);

    // Calculate items based on rows and columns
    const bufferStartRow = Math.max(0, startRow - bufferSize);
    const bufferEndRow = Math.min(Math.ceil(totalItems / colCount), endRow + bufferSize);

    const start = bufferStartRow * colCount;
    const end = Math.min(totalItems, bufferEndRow * colCount);

    // Ensure we always show at least some items
    const minEnd = Math.min(this.maxVisibleItems, totalItems);
    const finalEnd = Math.max(end, minEnd);

    return { start, end: finalEnd };
  }

  /**
   * Calculate grid position for an item
   */
  calculateGridPosition(index, colCount, itemWidth, itemHeight, spacing) {
    const row = Math.floor(index / colCount);
    const col = index % colCount;
    const top = row * (itemHeight + spacing);
    const left = col * (itemWidth + spacing);

    return { top, left, row, col };
  }

  /**
   * Calculate list position for an item
   */
  calculateListPosition(index, itemHeight) {
    const top = index * itemHeight;
    return { top };
  }

  /**
   * Get current visible range
   */
  getVisibleRange() {
    return { start: this.visibleStart, end: this.visibleEnd };
  }

  /**
   * Get column count (for grid layouts)
   */
  getColCount() {
    return this.colCount;
  }

  /**
   * Abstract method to get total items - should be overridden
   */
  getTotalItems() {
    return 0;
  }
}

/**
 * Grid-specific virtual scroll manager
 */
export class GridVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: SCROLL_CONSTANTS.GRID_ITEM_HEIGHT,
      itemWidth: SCROLL_CONSTANTS.GRID_ITEM_WIDTH,
      cardSpacing: SCROLL_CONSTANTS.GRID_CARD_SPACING,
      ...options
    });
  }

  /**
   * Override updateColCount for grid with better calculation
   */
  updateColCount() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    if (width === 0) return;

    // Account for padding in the container (16px on each side)
    const availableWidth = width - 32;
    // Use the actual item width + spacing for calculation
    const itemWithSpacing = this.itemWidth + this.cardSpacing;
    const newColCount = Math.max(1, Math.floor(availableWidth / itemWithSpacing));
    
    if (newColCount !== this.colCount) {
      this.colCount = newColCount;
      this.onColCountChange(this.colCount);
    }
  }

  /**
   * Calculate total height for grid layout
   */
  calculateTotalHeight(totalItems) {
    const totalRows = Math.ceil(totalItems / this.colCount);
    return totalRows * (this.itemHeight + this.cardSpacing);
  }

  /**
   * Calculate position for grid item
   */
  calculateItemPosition(index) {
    return this.calculateGridPosition(
      index,
      this.colCount,
      this.itemWidth,
      this.itemHeight,
      this.cardSpacing,
    );
  }
}

/**
 * List-specific virtual scroll manager
 */
export class ListVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: SCROLL_CONSTANTS.LIST_ITEM_HEIGHT,
      itemWidth: 0, // Not used for list
      cardSpacing: 0, // Not used for list
      ...options
    });
    this.colCount = 1; // List always has 1 column
  }

  /**
   * Use the same onScroll logic as the base class - no override needed
   * The base class calculateVisibleRange method works correctly for both grid and list
   */

  /**
   * Calculate total height for list layout
   */
  calculateTotalHeight(totalItems) {
    return totalItems * this.itemHeight;
  }

  /**
   * Calculate position for list item
   */
  calculateItemPosition(index) {
    return this.calculateListPosition(index, this.itemHeight);
  }

  /**
   * Override updateColCount for list (always 1 column)
   */
  updateColCount() {
    // List always has 1 column, no need to calculate
  }
}
