import logger from './logger.js';

class BrowserStorage {
  constructor(type = 'indexeddb') {
    this.type = type;
    this.dbVersion = 3;
    this.dbName = 'MediaLibrary';
  }

  async ensureDatabase() {
    if (this.type !== 'indexeddb') return null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }

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

  async save(data, siteKey = 'media-data') {
    switch (this.type) {
      case 'indexeddb':
        return this.saveToIndexedDB(data, siteKey);
      case 'none':
        // No-op for 'none' storage type
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async load(siteKey = 'media-data') {
    switch (this.type) {
      case 'indexeddb':
        return this.loadFromIndexedDB(siteKey);
      case 'none':
        // Return empty array for 'none' storage type
        return [];
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async saveToIndexedDB(data, siteKey = 'media-data') {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        logger.warn('Media object store does not exist, cannot save data');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');

        const saveRequest = store.put({
          id: siteKey,
          data,
          timestamp: Date.now(),
          siteKey,
        });
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => {
          reject(saveRequest.error);
        };
      });
    } catch (error) {
      logger.error('Failed to save to IndexedDB:', error);
      throw error;
    }
  }

  async loadFromIndexedDB(siteKey = 'media-data') {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        logger.warn('Media object store does not exist, returning empty array');
        return [];
      }

      return new Promise((resolve) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get(siteKey);

        getRequest.onsuccess = () => {
          const { result } = getRequest;
          resolve(result ? result.data : []);
        };

        getRequest.onerror = () => {
          logger.warn('Failed to get data from IndexedDB:', getRequest.error);
          resolve([]);
        };
      });
    } catch (error) {
      logger.warn('Failed to load from IndexedDB:', error);
      return [];
    }
  }

  async clear() {
    switch (this.type) {
      case 'indexeddb':
        return this.clearIndexedDB();
      case 'none':
        // No-op for 'none' storage type
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async clearIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      const storesToClear = [];
      if (db.objectStoreNames.contains('media')) {
        storesToClear.push('media');
      }
      if (db.objectStoreNames.contains('last-modified-data')) {
        storesToClear.push('last-modified-data');
      }

      if (storesToClear.length === 0) {
        logger.warn('No object stores exist, nothing to clear');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storesToClear, 'readwrite');

        let completedStores = 0;
        const totalStores = storesToClear.length;

        storesToClear.forEach((storeName) => {
          const store = transaction.objectStore(storeName);
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => {
            completedStores += 1;
            if (completedStores === totalStores) {
              resolve();
            }
          };

          clearRequest.onerror = () => {
            reject(clearRequest.error);
          };
        });
      });
    } catch (error) {
      logger.warn('Failed to clear IndexedDB:', error);
      return Promise.resolve();
    }
  }

  async resetDatabase() {
    if (this.type !== 'indexeddb') return Promise.resolve();

    try {
      if (this._db) {
        this._db.close();
      }

      return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);

        deleteRequest.onsuccess = () => {
          resolve();
        };

        deleteRequest.onerror = () => {
          reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
          reject(new Error('Database deletion blocked'));
        };
      });
    } catch (error) {
      logger.error('Failed to reset database:', error);
      throw error;
    }
  }

  async getLastModified() {
    switch (this.type) {
      case 'indexeddb':
        return this.getLastModifiedFromIndexedDB();
      case 'none':
        return null;
      default:
        return null;
    }
  }

  async getLastModifiedFromIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return null;
      }

      return new Promise((resolve) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get('media-data');

        getRequest.onsuccess = () => {
          const { result } = getRequest;
          resolve(result ? result.timestamp : null);
        };

        getRequest.onerror = () => {
          logger.warn('Failed to get last modified from IndexedDB:', getRequest.error);
          resolve(null);
        };
      });
    } catch (error) {
      logger.warn('Failed to get last modified from IndexedDB:', error);
      return null;
    }
  }

  async getAllSites() {
    switch (this.type) {
      case 'indexeddb':
        return this.getAllSitesFromIndexedDB();
      case 'none':
        // Return empty array for 'none' storage type
        return [];
      default:
        return [];
    }
  }

  async getAllSitesFromIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return [];
      }

      return new Promise((resolve) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const results = getAllRequest.result;
          const sites = results.map((result) => ({
            siteKey: result.siteKey || result.id,
            timestamp: result.timestamp,
            itemCount: result.data ? result.data.length : 0,
          }));
          resolve(sites);
        };

        getAllRequest.onerror = () => {
          logger.warn('Failed to get all sites from IndexedDB:', getAllRequest.error);
          resolve([]);
        };
      });
    } catch (error) {
      logger.warn('Failed to get all sites from IndexedDB:', error);
      return [];
    }
  }

  async deleteSite(siteKey) {
    switch (this.type) {
      case 'indexeddb':
        return this.deleteSiteFromIndexedDB(siteKey);
      case 'none':
        // No-op for 'none' storage type
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async deleteSiteFromIndexedDB(siteKey) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('media')) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const deleteRequest = store.delete(siteKey);

        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => {
          reject(deleteRequest.error);
        };
      });
    } catch (error) {
      logger.error('Failed to delete site from IndexedDB:', error);
      throw error;
    }
  }

  async saveScanMetadata(siteKey, metadata) {
    switch (this.type) {
      case 'indexeddb':
        return this.saveScanMetadataToIndexedDB(siteKey, metadata);
      case 'none':
        // No-op for 'none' storage type
        return Promise.resolve();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async loadScanMetadata(siteKey) {
    switch (this.type) {
      case 'indexeddb':
        return this.loadScanMetadataFromIndexedDB(siteKey);
      case 'none':
        // Return null for 'none' storage type
        return null;
      default:
        return null;
    }
  }

  async saveScanMetadataToIndexedDB(siteKey, metadata) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('last-modified-data')) {
        logger.warn('Last modified data object store does not exist, cannot save metadata');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['last-modified-data'], 'readwrite');
        const store = transaction.objectStore('last-modified-data');

        const saveRequest = store.put({
          siteKey,
          ...metadata,
          timestamp: Date.now(),
        });
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => {
          reject(saveRequest.error);
        };
      });
    } catch (error) {
      logger.error('Failed to save scan metadata to IndexedDB:', error);
      throw error;
    }
  }

  async loadScanMetadataFromIndexedDB(siteKey) {
    try {
      const db = await this.ensureDatabase();

      if (!db.objectStoreNames.contains('last-modified-data')) {
        return null;
      }

      return new Promise((resolve) => {
        const transaction = db.transaction(['last-modified-data'], 'readonly');
        const store = transaction.objectStore('last-modified-data');
        const getRequest = store.get(siteKey);

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
}

export default BrowserStorage;
