// src/utils/storage.js
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
      case 'local':
        return this.saveToLocalStorage(data, siteKey);
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async load(siteKey = 'media-data') {
    switch (this.type) {
      case 'indexeddb':
        return this.loadFromIndexedDB(siteKey);
      case 'local':
        return this.loadFromLocalStorage(siteKey);
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
          // Failed to save to IndexedDB
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

  async saveToLocalStorage(data, siteKey = 'media-data') {
    try {
      localStorage.setItem(`media-library-${siteKey}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        siteKey,
      }));
    } catch (error) {
      throw new Error(`Failed to save to localStorage: ${error.message}`);
    }
  }

  async loadFromLocalStorage(siteKey = 'media-data') {
    try {
      const stored = localStorage.getItem(`media-library-${siteKey}`);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return parsed.data || [];
    } catch (error) {
      logger.warn('Failed to load from localStorage:', error);
      return [];
    }
  }

  async clear() {
    switch (this.type) {
      case 'indexeddb':
        return this.clearIndexedDB();
      case 'local':
        return this.clearLocalStorage();
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
            // Failed to clear store
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
          // Database deleted successfully
          resolve();
        };

        deleteRequest.onerror = () => {
          // Failed to delete database
          reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
          // Database deletion blocked, please close other tabs
          reject(new Error('Database deletion blocked'));
        };
      });
    } catch (error) {
      logger.error('Failed to reset database:', error);
      throw error;
    }
  }

  async clearLocalStorage() {
    localStorage.removeItem('media-library-data');
  }

  async getLastModified() {
    switch (this.type) {
      case 'indexeddb':
        return this.getLastModifiedFromIndexedDB();
      case 'local':
        return this.getLastModifiedFromLocalStorage();
      default:
        return null;
    }
  }

  async getLastModifiedFromIndexedDB() {
    try {
      const db = await this.ensureDatabase();

      // Check if the object store exists
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

  async getLastModifiedFromLocalStorage() {
    try {
      const stored = localStorage.getItem('media-library-data');
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return parsed.timestamp || null;
    } catch (error) {
      return null;
    }
  }

  async getAllSites() {
    switch (this.type) {
      case 'indexeddb':
        return this.getAllSitesFromIndexedDB();
      case 'local':
        return this.getAllSitesFromLocalStorage();
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

  async getAllSitesFromLocalStorage() {
    try {
      const sites = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('media-library-')) {
          const siteKey = key.replace('media-library-', '');
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            sites.push({
              siteKey,
              timestamp: parsed.timestamp,
              itemCount: parsed.data ? parsed.data.length : 0,
            });
          }
        }
      }
      return sites;
    } catch (error) {
      logger.warn('Failed to get all sites from localStorage:', error);
      return [];
    }
  }

  async deleteSite(siteKey) {
    switch (this.type) {
      case 'indexeddb':
        return this.deleteSiteFromIndexedDB(siteKey);
      case 'local':
        return this.deleteSiteFromLocalStorage(siteKey);
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
          // Failed to delete site from IndexedDB
          reject(deleteRequest.error);
        };
      });
    } catch (error) {
      logger.error('Failed to delete site from IndexedDB:', error);
      throw error;
    }
  }

  async deleteSiteFromLocalStorage(siteKey) {
    try {
      localStorage.removeItem(`media-library-${siteKey}`);
    } catch (error) {
      throw new Error(`Failed to delete site from localStorage: ${error.message}`);
    }
  }

  async saveScanMetadata(siteKey, metadata) {
    switch (this.type) {
      case 'indexeddb':
        return this.saveScanMetadataToIndexedDB(siteKey, metadata);
      case 'local':
        return this.saveScanMetadataToLocalStorage(siteKey, metadata);
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async loadScanMetadata(siteKey) {
    switch (this.type) {
      case 'indexeddb':
        return this.loadScanMetadataFromIndexedDB(siteKey);
      case 'local':
        return this.loadScanMetadataFromLocalStorage(siteKey);
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
          // Failed to save scan metadata to IndexedDB
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

  async saveScanMetadataToLocalStorage(siteKey, metadata) {
    try {
      localStorage.setItem(`scan-metadata-${siteKey}`, JSON.stringify({
        siteKey,
        ...metadata,
        timestamp: Date.now(),
      }));
    } catch (error) {
      throw new Error(`Failed to save scan metadata to localStorage: ${error.message}`);
    }
  }

  async loadScanMetadataFromLocalStorage(siteKey) {
    try {
      const stored = localStorage.getItem(`scan-metadata-${siteKey}`);
      if (!stored) return null;

      return JSON.parse(stored);
    } catch (error) {
      logger.warn('Failed to load scan metadata from localStorage:', error);
      return null;
    }
  }
}

export default BrowserStorage;
