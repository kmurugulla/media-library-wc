// src/utils/virtual-scroll/list.js
import { VirtualScrollManager } from './base.js';

/**
 * Virtual scroll manager specifically for list layouts
 */
class ListVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: 80,
      itemWidth: 0, // Not used for list layout
      cardSpacing: 0, // Not used for list layout
      ...options,
    });
  }

  /**
   * Calculate which items should be visible for list layout
   */
  calculateVisibleRange() {
    if (!this.container || this.totalItems === 0) {
      this.visibleStart = 0;
      this.visibleEnd = 0;
      return;
    }

    const { scrollTop } = this.container;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + this.containerHeight) / this.itemHeight);

    this.visibleStart = Math.max(0, startIndex - this.bufferSize);
    this.visibleEnd = Math.min(this.totalItems, endIndex + this.bufferSize);

    // Limit visible items to prevent performance issues
    if (this.visibleEnd - this.visibleStart > this.maxVisibleItems) {
      const center = Math.floor((this.visibleStart + this.visibleEnd) / 2);
      this.visibleStart = Math.max(0, center - Math.floor(this.maxVisibleItems / 2));
      this.visibleEnd = Math.min(this.totalItems, this.visibleStart + this.maxVisibleItems);
    }
  }

  /**
   * Scroll to specific item in list
   * @param {number} index - Item index to scroll to
   */
  scrollToItem(index) {
    if (!this.container || index < 0 || index >= this.totalItems) return;

    const scrollTop = index * this.itemHeight;
    this.container.scrollTop = scrollTop;
  }

  /**
   * Get total height of all items
   * @returns {number} Total height in pixels
   */
  getTotalHeight() {
    return this.totalItems * this.itemHeight;
  }

  /**
   * Get offset for a specific item
   * @param {number} index - Item index
   * @returns {number} Offset in pixels
   */
  getItemOffset(index) {
    return index * this.itemHeight;
  }
}

export default ListVirtualScrollManager;
