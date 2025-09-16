class Queue {
  constructor(callback, maxConcurrent = 20, onError = null) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrent = maxConcurrent;
    this.callback = callback;
    this.onError = onError;
  }

  async push(data) {
    this.queue.push(data);
    await this.processQueue();
  }

  async processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      await this.processItem(item);
    }
  }

  async processItem(item) {
    this.activeCount += 1;
    try {
      await this.callback(item);
    } catch (e) {
      if (this.onError) {
        this.onError(item, e);
      } else {
        throw e;
      }
    } finally {
      this.activeCount -= 1;
      await this.processQueue();
    }
  }
}

export default Queue;
