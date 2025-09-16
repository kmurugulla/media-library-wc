import { VirtualScrollManager } from './base.js';

class ListVirtualScrollManager extends VirtualScrollManager {
  constructor(options = {}) {
    super({
      itemHeight: 80,
      itemWidth: 0,
      cardSpacing: 0,
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
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + this.containerHeight) / this.itemHeight);

    this.visibleStart = Math.max(0, startIndex - this.bufferSize);
    this.visibleEnd = Math.min(this.totalItems, endIndex + this.bufferSize);

    if (this.visibleEnd - this.visibleStart > this.maxVisibleItems) {
      const center = Math.floor((this.visibleStart + this.visibleEnd) / 2);
      this.visibleStart = Math.max(0, center - Math.floor(this.maxVisibleItems / 2));
      this.visibleEnd = Math.min(this.totalItems, this.visibleStart + this.maxVisibleItems);
    }
  }

  scrollToItem(index) {
    if (!this.container || index < 0 || index >= this.totalItems) return;

    const scrollTop = index * this.itemHeight;
    this.container.scrollTop = scrollTop;
  }

  getTotalHeight() {
    return this.totalItems * this.itemHeight;
  }

  getItemOffset(index) {
    return index * this.itemHeight;
  }
}

export default ListVirtualScrollManager;
