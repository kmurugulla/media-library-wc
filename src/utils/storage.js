// src/utils/storage.js
class BrowserStorage {
  constructor(type = 'indexeddb') {
    this.type = type;
    this.dbVersion = 3; // Incremented to rename scanMetadata to last-modified-data
    this.dbName = 'MediaLibrary';
  }

  async ensureDatabase() {
    if (this.type !== 'indexeddb') return;
    
    return new Promise((resolve, reject) => {
      // Open database with a specific version to ensure onupgradeneeded fires
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
        
        // Create scan metadata store if it doesn't exist
        if (!db.objectStoreNames.contains('last-modified-data')) {
          db.createObjectStore('last-modified-data', { keyPath: 'siteKey' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        resolve(db);
      };
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
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
      
      // Check if the object store exists
      if (!db.objectStoreNames.contains('media')) {
        console.warn('Media object store does not exist, cannot save data');
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        
        const saveRequest = store.put({ 
          id: siteKey, 
          data, 
          timestamp: Date.now(),
          siteKey: siteKey
        });
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => {
          console.error('Failed to save to IndexedDB:', saveRequest.error);
          reject(saveRequest.error);
        };
      });
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
      throw error;
    }
  }

  async loadFromIndexedDB(siteKey = 'media-data') {
    try {
      const db = await this.ensureDatabase();
      
      // Check if the object store exists
      if (!db.objectStoreNames.contains('media')) {
        console.warn('Media object store does not exist, returning empty array');
        return [];
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get(siteKey);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.data : []);
        };
        
        getRequest.onerror = () => {
          console.warn('Failed to get data from IndexedDB:', getRequest.error);
          resolve([]); // Return empty array instead of rejecting
        };
      });
    } catch (error) {
      // If database setup fails, return empty array
      console.warn('Failed to load from IndexedDB:', error);
      return [];
    }
  }

  async saveToLocalStorage(data, siteKey = 'media-data') {
    try {
      localStorage.setItem(`media-library-${siteKey}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        siteKey: siteKey
      }));
    } catch (error) {
      throw new Error('Failed to save to localStorage: ' + error.message);
    }
  }

  async loadFromLocalStorage(siteKey = 'media-data') {
    try {
      const stored = localStorage.getItem(`media-library-${siteKey}`);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      return parsed.data || [];
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
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
      
      // Check which object stores exist
      const storesToClear = [];
      if (db.objectStoreNames.contains('media')) {
        storesToClear.push('media');
      }
      if (db.objectStoreNames.contains('last-modified-data')) {
        storesToClear.push('last-modified-data');
      }
      
      if (storesToClear.length === 0) {
        console.warn('No object stores exist, nothing to clear');
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storesToClear, 'readwrite');
        
        let completedStores = 0;
        const totalStores = storesToClear.length;
        
        storesToClear.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const clearRequest = store.clear();
          
          clearRequest.onsuccess = () => {
            completedStores++;
            if (completedStores === totalStores) {
              resolve();
            }
          };
          
          clearRequest.onerror = () => {
            console.error(`Failed to clear ${storeName}:`, clearRequest.error);
            reject(clearRequest.error);
          };
        });
      });
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
    }
  }

  async resetDatabase() {
    if (this.type !== 'indexeddb') return;
    
    try {
      // Close any existing connections
      if (this._db) {
        this._db.close();
      }
      
      // Delete the database
      return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);
        
        deleteRequest.onsuccess = () => {
          console.log('Database deleted successfully');
          resolve();
        };
        
        deleteRequest.onerror = () => {
          console.error('Failed to delete database:', deleteRequest.error);
          reject(deleteRequest.error);
        };
        
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked, please close other tabs');
          reject(new Error('Database deletion blocked'));
        };
      });
    } catch (error) {
      console.error('Failed to reset database:', error);
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
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getRequest = store.get('media-data');
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.timestamp : null);
        };
        
        getRequest.onerror = () => {
          console.warn('Failed to get last modified from IndexedDB:', getRequest.error);
          resolve(null); // Return null instead of rejecting
        };
      });
    } catch (error) {
      console.warn('Failed to get last modified from IndexedDB:', error);
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

  // New methods for multi-site support
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
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          const results = getAllRequest.result;
          const sites = results.map(result => ({
            siteKey: result.siteKey || result.id,
            timestamp: result.timestamp,
            itemCount: result.data ? result.data.length : 0
          }));
          resolve(sites);
        };
        
        getAllRequest.onerror = () => {
          console.warn('Failed to get all sites from IndexedDB:', getAllRequest.error);
          resolve([]);
        };
      });
    } catch (error) {
      console.warn('Failed to get all sites from IndexedDB:', error);
      return [];
    }
  }

  async getAllSitesFromLocalStorage() {
    try {
      const sites = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('media-library-')) {
          const siteKey = key.replace('media-library-', '');
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            sites.push({
              siteKey: siteKey,
              timestamp: parsed.timestamp,
              itemCount: parsed.data ? parsed.data.length : 0
            });
          }
        }
      }
      return sites;
    } catch (error) {
      console.warn('Failed to get all sites from localStorage:', error);
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
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const deleteRequest = store.delete(siteKey);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => {
          console.error('Failed to delete site from IndexedDB:', deleteRequest.error);
          reject(deleteRequest.error);
        };
      });
    } catch (error) {
      console.error('Failed to delete site from IndexedDB:', error);
      throw error;
    }
  }

  async deleteSiteFromLocalStorage(siteKey) {
    try {
      localStorage.removeItem(`media-library-${siteKey}`);
    } catch (error) {
      throw new Error('Failed to delete site from localStorage: ' + error.message);
    }
  }

  // Scan metadata methods for incremental scanning
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
        console.warn('Last modified data object store does not exist, cannot save metadata');
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['last-modified-data'], 'readwrite');
        const store = transaction.objectStore('last-modified-data');
        
        const saveRequest = store.put({ 
          siteKey: siteKey, 
          ...metadata,
          timestamp: Date.now()
        });
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => {
          console.error('Failed to save scan metadata to IndexedDB:', saveRequest.error);
          reject(saveRequest.error);
        };
      });
    } catch (error) {
      console.error('Failed to save scan metadata to IndexedDB:', error);
      throw error;
    }
  }

  async loadScanMetadataFromIndexedDB(siteKey) {
    try {
      const db = await this.ensureDatabase();
      
      if (!db.objectStoreNames.contains('last-modified-data')) {
        return null;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['last-modified-data'], 'readonly');
        const store = transaction.objectStore('last-modified-data');
        const getRequest = store.get(siteKey);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result || null);
        };
        
        getRequest.onerror = () => {
          console.warn('Failed to get scan metadata from IndexedDB:', getRequest.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.warn('Failed to load scan metadata from IndexedDB:', error);
      return null;
    }
  }

  async saveScanMetadataToLocalStorage(siteKey, metadata) {
    try {
      localStorage.setItem(`scan-metadata-${siteKey}`, JSON.stringify({
        siteKey: siteKey,
        ...metadata,
        timestamp: Date.now()
      }));
    } catch (error) {
      throw new Error('Failed to save scan metadata to localStorage: ' + error.message);
    }
  }

  async loadScanMetadataFromLocalStorage(siteKey) {
    try {
      const stored = localStorage.getItem(`scan-metadata-${siteKey}`);
      if (!stored) return null;
      
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to load scan metadata from localStorage:', error);
      return null;
    }
  }
}

export { BrowserStorage };
