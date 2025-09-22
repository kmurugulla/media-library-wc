import logger from './logger.js';

class BrowserStorage {
  constructor(type = 'indexeddb', siteKey = null) {
    this.type = type;
    this.dbVersion = 7;
    this.siteKey = siteKey;
    this.dbName = siteKey ? `media_${this.normalizeSiteKey(siteKey)}` : 'MediaLibrary';
  }

  normalizeSiteKey(siteKey) {
    if (!siteKey) return 'unknown';
    return siteKey
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  denormalizeSiteKey(normalizedSiteKey) {
    return normalizedSiteKey
      .replace(/_/g, '.')
      .replace(/^www_/, 'www.');
  }

  async ensureDatabase() {
    if (this.type !== 'indexeddb') return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (db.objectStoreNames.contains('processedData')) {
          db.deleteObjectStore('processedData');
        }

        if (db.objectStoreNames.contains('media')) {
          db.deleteObjectStore('media');
        }

        const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        mediaStore.createIndex('hash', 'hash', { unique: false });
        mediaStore.createIndex('url', 'url', { unique: false });
        mediaStore.createIndex('doc', 'doc', { unique: false });
        mediaStore.createIndex('name', 'name', { unique: false });

        if (!db.objectStoreNames.contains('last-modified-data')) {
          db.createObjectStore('last-modified-data', { keyPath: 'siteKey' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        resolve(db);
      };

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async save(data) {
    switch (this.type) {
      case 'indexeddb':
        return this.saveItemsToIndexedDB(data);
      case 'none':
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async saveItemsToIndexedDB(items) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        logger.warn('Media object store does not exist, cannot save data');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');

        let savedCount = 0;
        const totalItems = items.length;

        if (totalItems === 0) {
          resolve();
          return;
        }

        items.forEach((item) => {
          const rowData = {
            ...item,
            timestamp: Date.now(),
          };

          const saveRequest = store.put(rowData);
          saveRequest.onsuccess = () => {
            savedCount += 1;
            if (savedCount === totalItems) {
              resolve();
            }
          };
          saveRequest.onerror = () => {
            reject(saveRequest.error);
          };
        });
      });
    } catch (error) {
      logger.error('Failed to save items to IndexedDB:', error);
      throw error;
    }
  }

  async load() {
    switch (this.type) {
      case 'indexeddb':
        return this.loadRawDataBySite();
      case 'none':
        return [];
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async loadChunk(offset, limit) {
    switch (this.type) {
      case 'indexeddb':
        return this.loadRawDataChunk(offset, limit);
      case 'none':
        return [];
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async loadUniqueMediaItems() {
    switch (this.type) {
      case 'indexeddb':
        return this.loadUniqueMediaItemsFromIndexedDB();
      case 'none':
        return [];
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async loadRawDataBySite() {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        logger.warn('Media object store does not exist, returning empty array');
        return [];
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          const cleanResults = results.map((item) => {
            const { timestamp: _, ...cleanItem } = item;
            return cleanItem;
          });
          resolve(cleanResults);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to load raw data from IndexedDB:', error);
      return [];
    }
  }

  async loadRawDataChunk(offset, limit) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return [];
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');

        const request = store.openCursor();
        const results = [];
        let currentOffset = 0;

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (!cursor) {
            const cleanResults = results.map((item) => {
              const { timestamp: _, ...cleanItem } = item;
              return cleanItem;
            });
            resolve(cleanResults);
            return;
          }

          if (currentOffset < offset) {
            currentOffset += 1;
            cursor.continue();
            return;
          }

          results.push(cursor.value);

          if (results.length >= limit) {
            const cleanResults = results.map((item) => {
              const { timestamp: _, ...cleanItem } = item;
              return cleanItem;
            });
            resolve(cleanResults);
            return;
          }

          cursor.continue();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to load raw data chunk from IndexedDB:', error);
      return [];
    }
  }

  async loadUniqueMediaItemsFromIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return [];
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');

        const request = store.openCursor();
        const uniqueItems = new Map();

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (!cursor) {
            const results = Array.from(uniqueItems.values());
            const cleanResults = results.map((item) => {
              const { timestamp: _, ...cleanItem } = item;
              return cleanItem;
            });
            resolve(cleanResults);
            return;
          }

          const item = cursor.value;

          if (!uniqueItems.has(item.url)) {
            uniqueItems.set(item.url, item);
          }

          cursor.continue();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to load unique media items from IndexedDB:', error);
      return [];
    }
  }

  async getItemByHash(hash) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const index = store.index('hash');
        const request = index.get(hash);

        request.onsuccess = () => {
          const { result } = request;
          if (result) {
            const { timestamp: _, ...cleanItem } = result;
            resolve(cleanItem);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to get item by hash:', error);
      return null;
    }
  }

  async getAllSites() {
    switch (this.type) {
      case 'indexeddb':
        return this.getAllSitesFromIndexedDB();
      case 'none':
        return [];
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async getAllSitesFromIndexedDB() {
    try {
      const sites = [];
      const databases = await this.getAllDatabases();

      for (const dbName of databases) {
        if (dbName.startsWith('media_')) {
          const normalizedSiteKey = dbName.replace('media_', '');
          const siteKey = this.denormalizeSiteKey(normalizedSiteKey);

          try {
            const siteStorage = new BrowserStorage('indexeddb', siteKey);
            const db = await siteStorage.ensureDatabase();

            if (db && db.objectStoreNames.contains('media')) {
              const transaction = db.transaction(['media'], 'readonly');
              const store = transaction.objectStore('media');
              const countRequest = store.count();

              const count = await new Promise((resolve, reject) => {
                countRequest.onsuccess = () => resolve(countRequest.result);
                countRequest.onerror = () => reject(countRequest.error);
              });

              let timestamp = Date.now();
              if (db.objectStoreNames.contains('last-modified-data')) {
                const metaTransaction = db.transaction(['last-modified-data'], 'readonly');
                const metaStore = metaTransaction.objectStore('last-modified-data');
                const metaRequest = metaStore.get(this.siteKey || 'default');

                try {
                  const metaResult = await new Promise((resolve, reject) => {
                    metaRequest.onsuccess = () => resolve(metaRequest.result);
                    metaRequest.onerror = () => reject(metaRequest.error);
                  });

                  if (metaResult && metaResult.timestamp) {
                    timestamp = metaResult.timestamp;
                  }
                } catch (error) {
                  // Ignore metadata errors
                }
              }

              sites.push({
                siteKey,
                itemCount: count,
                timestamp,
              });
            }
          } catch (error) {
            // Skip databases that can't be accessed
          }
        }
      }

      return sites.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to get all sites from IndexedDB:', error);
      return [];
    }
  }

  async getAllDatabases() {
    try {
      // Use the modern IndexedDB API to get all databases
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        const databases = await indexedDB.databases();
        const mediaDatabases = databases
          .map((db) => db.name)
          .filter((name) => name && name.startsWith('media_'));

        logger.debug('Found databases via indexedDB.databases():', mediaDatabases);
        return mediaDatabases;
      }
      logger.warn('indexedDB.databases() not supported in this browser');
      return [];
    } catch (error) {
      logger.error('Failed to get all databases:', error);
      return [];
    }
  }

  async deleteSite(siteKey) {
    switch (this.type) {
      case 'indexeddb':
        return this.deleteSiteFromIndexedDB(siteKey);
      case 'none':
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async deleteSiteFromIndexedDB(siteKey) {
    try {
      const normalizedSiteKey = this.normalizeSiteKey(siteKey);
      const dbName = `media_${normalizedSiteKey}`;

      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);

        deleteRequest.onsuccess = () => {
          logger.info(`Successfully deleted database: ${dbName}`);
          resolve();
        };

        deleteRequest.onerror = () => {
          logger.error(`Failed to delete database: ${dbName}`, deleteRequest.error);
          reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
          logger.warn(`Database deletion blocked: ${dbName}`);
          reject(new Error('Database deletion blocked - please close other tabs and try again'));
        };
      });
    } catch (error) {
      logger.error('Failed to delete site from IndexedDB:', error);
      throw error;
    }
  }

  async saveScanMetadata(metadata) {
    switch (this.type) {
      case 'indexeddb':
        return this.saveScanMetadataToIndexedDB(metadata);
      case 'none':
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async removeMediaForPages(pages) {
    switch (this.type) {
      case 'indexeddb':
        return this.removeMediaForPagesFromIndexedDB(pages);
      case 'none':
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async removeMediaForPagesFromIndexedDB(pages) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (!cursor) {
            resolve();
            return;
          }

          const item = cursor.value;
          if (pages.includes(item.doc)) {
            cursor.delete();
          }

          cursor.continue();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to remove media for pages from IndexedDB:', error);
      throw error;
    }
  }

  async loadScanMetadata() {
    switch (this.type) {
      case 'indexeddb':
        return this.loadScanMetadataFromIndexedDB();
      case 'none':
        return null;
      default:
        return null;
    }
  }

  async saveScanMetadataToIndexedDB(metadata) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('last-modified-data')) {
        logger.warn('Last modified data object store does not exist, cannot save metadata');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['last-modified-data'], 'readwrite');
        const store = transaction.objectStore('last-modified-data');

        // First, load existing metadata to merge with new data
        const getRequest = store.get(this.siteKey || 'default');

        getRequest.onsuccess = () => {
          const existingMetadata = getRequest.result || {};

          // Merge existing pageLastModified with new pageLastModified
          const mergedPageLastModified = {
            ...existingMetadata.pageLastModified,
            ...metadata.pageLastModified,
          };

          // Create merged metadata
          const mergedMetadata = {
            siteKey: this.siteKey || 'default',
            ...existingMetadata,
            ...metadata,
            pageLastModified: mergedPageLastModified,
            timestamp: Date.now(),
          };

          // Save the merged metadata
          const saveRequest = store.put(mergedMetadata);
          saveRequest.onsuccess = () => resolve();
          saveRequest.onerror = () => {
            reject(saveRequest.error);
          };
        };

        getRequest.onerror = () => {
          reject(getRequest.error);
        };
      });
    } catch (error) {
      logger.error('Failed to save scan metadata to IndexedDB:', error);
      throw error;
    }
  }

  async loadScanMetadataFromIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('last-modified-data')) {
        return null;
      }

      return new Promise((resolve) => {
        const transaction = db.transaction(['last-modified-data'], 'readonly');
        const store = transaction.objectStore('last-modified-data');
        const getRequest = store.get(this.siteKey || 'default');

        getRequest.onsuccess = () => {
          const { result } = getRequest;
          resolve(result || null);
        };

        getRequest.onerror = () => {
          logger.warn('Failed to get scan metadata from IndexedDB:', getRequest.error);
          resolve(null);
        };
      });
    } catch (error) {
      logger.warn('Failed to load scan metadata from IndexedDB:', error);
      return null;
    }
  }

  async clearAllSites() {
    try {
      const sites = await this.getAllSites();

      for (const site of sites) {
        await this.deleteSiteFromIndexedDB(site.siteKey);
      }

      logger.info(`Cleared all ${sites.length} sites from IndexedDB`);
    } catch (error) {
      logger.error('Failed to clear all sites:', error);
      throw error;
    }
  }
}

export default BrowserStorage;
