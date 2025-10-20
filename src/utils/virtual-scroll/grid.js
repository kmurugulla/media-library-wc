import { VirtualScrollManager } from './base.js';

class GridVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: 300,
      itemWidth: 324,
      cardSpacing: 24,
      ...options,
    });
  }

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

  getItemsPerRow() {
    return Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
  }

  getTotalRows() {
    const itemsPerRow = this.getItemsPerRow();
    return Math.ceil(this.totalItems / itemsPerRow);
  }

  getRowForItem(index) {
    const itemsPerRow = this.getItemsPerRow();
    return Math.floor(index / itemsPerRow);
  }

  getColumnForItem(index) {
    const itemsPerRow = this.getItemsPerRow();
    return index % itemsPerRow;
  }
}

export default GridVirtualScrollManager;
