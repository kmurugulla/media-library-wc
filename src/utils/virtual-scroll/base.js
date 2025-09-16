export const SCROLL_CONSTANTS = {
  GRID_ITEM_WIDTH: 410,
  GRID_ITEM_HEIGHT: 400,
  GRID_CARD_SPACING: 20,

  LIST_ITEM_HEIGHT: 80,

  BUFFER_SIZE: 5,
  SCROLL_THROTTLE: 16,
  MAX_VISIBLE_ITEMS: 50,

  MIN_BUFFER_SIZE: 3,
  MAX_BUFFER_SIZE: 10,
  FAST_SCROLL_THRESHOLD: 100,
};

export class VirtualScrollManager {
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

    this.lastScrollTop = 0;
    this.lastScrollTime = 0;
    this.scrollSpeed = 0;

    this.onRangeChange = options.onRangeChange || null;
    this.onColCountChange = options.onColCountChange || null;

    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  init(container, totalItems) {
    this.container = container;
    this.totalItems = totalItems;

    this.updateContainerDimensions();
    this.calculateVisibleRange();
    this.attachScrollListener();
    this.attachResizeListener();
  }

  updateContainerDimensions() {
    if (!this.container) return;

    const rect = this.container.getBoundingClientRect();
    this.containerHeight = rect.height;
    this.containerWidth = rect.width;
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

  onScroll() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    const currentTime = performance.now();
    const currentScrollTop = this.container.scrollTop;

    if (this.lastScrollTime > 0) {
      const timeDelta = currentTime - this.lastScrollTime;
      const scrollDelta = Math.abs(currentScrollTop - this.lastScrollTop);
      this.scrollSpeed = timeDelta > 0 ? scrollDelta / timeDelta : 0;

      if (this.scrollSpeed > SCROLL_CONSTANTS.FAST_SCROLL_THRESHOLD) {
        this.bufferSize = Math.min(SCROLL_CONSTANTS.MAX_BUFFER_SIZE, this.bufferSize + 1);
      } else {
        this.bufferSize = Math.max(SCROLL_CONSTANTS.MIN_BUFFER_SIZE, this.bufferSize - 1);
      }
    }

    this.lastScrollTop = currentScrollTop;
    this.lastScrollTime = currentTime;

    this.scrollTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        this.calculateVisibleRange();
        this.onVisibleRangeChange();
      });
    }, this.scrollThrottle);
  }

  onResize() {
    this.updateContainerDimensions();
    this.itemWidth = this.getResponsiveItemWidth();
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

  onVisibleRangeChange() {
    if (this.onRangeChange) {
      this.onRangeChange({
        start: this.visibleStart,
        end: this.visibleEnd,
      });
    }
  }

  attachScrollListener() {
    if (this.scrollListenerAttached || !this.container) return;

    this.container.addEventListener('scroll', this.onScroll, { passive: true });
    this.scrollListenerAttached = true;
  }

  detachScrollListener() {
    if (!this.scrollListenerAttached || !this.container) return;

    this.container.removeEventListener('scroll', this.onScroll);
    this.scrollListenerAttached = false;
  }

  attachResizeListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', this.onResize, { passive: true });
  }

  detachResizeListener() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('resize', this.onResize);
  }

  updateTotalItems(totalItems) {
    this.totalItems = totalItems;
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

  resetState(totalItems) {
    this.totalItems = totalItems;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.calculateVisibleRange();
    this.onVisibleRangeChange();
  }

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

  calculateTotalHeight(totalItems) {
    if (totalItems === 0) return 0;

    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const totalRows = Math.ceil(totalItems / itemsPerRow);
    return totalRows * (this.itemHeight + this.cardSpacing);
  }

  calculateItemPosition(index) {
    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;

    return {
      top: row * (this.itemHeight + this.cardSpacing),
      left: col * (this.itemWidth + this.cardSpacing),
    };
  }

  setupScrollListener(container) {
    this.container = container;
    this.updateContainerDimensions();
    this.calculateVisibleRange();
    this.attachScrollListener();
    this.attachResizeListener();
  }

  cleanup() {
    this.destroy();
  }

  getTotalItems() {
    return this.totalItems;
  }

  getVisibleRange() {
    return {
      start: this.visibleStart,
      end: this.visibleEnd,
    };
  }

  getVisibleItems(data) {
    if (!data || data.length === 0) return [];
    return data.slice(this.visibleStart, this.visibleEnd);
  }

  scrollToItem(index) {
    if (!this.container || index < 0 || index >= this.totalItems) return;

    const itemsPerRow = Math.floor(this.containerWidth / (this.itemWidth + this.cardSpacing));
    const row = Math.floor(index / itemsPerRow);
    const scrollTop = row * (this.itemHeight + this.cardSpacing);

    this.container.scrollTop = scrollTop;
  }

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
