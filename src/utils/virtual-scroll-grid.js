// src/utils/virtual-scroll-grid.js
import { VirtualScrollManager } from './virtual-scroll-base.js';

/**
 * Virtual scroll manager specifically for grid layouts
 */
class GridVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: 400,
      itemWidth: 410,
      cardSpacing: 20,
      ...options,
    });
  }

  /**
   * Calculate which items should be visible for grid layout
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
   * Get items per row based on current container width
   * @returns {number} Number of items per row
   */
  getItemsPerRow() {
    return Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
  }

  /**
   * Get total number of rows
   * @returns {number} Total number of rows
   */
  getTotalRows() {
    const itemsPerRow = this.getItemsPerRow();
    return Math.ceil(this.totalItems / itemsPerRow);
  }

  /**
   * Get row for a specific item index
   * @param {number} index - Item index
   * @returns {number} Row number
   */
  getRowForItem(index) {
    const itemsPerRow = this.getItemsPerRow();
    return Math.floor(index / itemsPerRow);
  }

  /**
   * Get column for a specific item index
   * @param {number} index - Item index
   * @returns {number} Column number
   */
  getColumnForItem(index) {
    const itemsPerRow = this.getItemsPerRow();
    return index % itemsPerRow;
  }
}

export default GridVirtualScrollManager;
