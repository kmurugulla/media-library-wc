// src/utils/storage.js
class BrowserStorage {
  constructor(type = 'indexeddb') {
    this.type = type;
    this.dbVersion = 1;
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

  async save(data) {
    switch (this.type) {
      case 'indexeddb':
        return this.saveToIndexedDB(data);
      case 'local':
        return this.saveToLocalStorage(data);
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async load() {
    switch (this.type) {
      case 'indexeddb':
        return this.loadFromIndexedDB();
      case 'local':
        return this.loadFromLocalStorage();
      default:
        throw new Error(`Unsupported storage type: ${this.type}`);
    }
  }

  async saveToIndexedDB(data) {
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
        
        const saveRequest = store.put({ id: 'media-data', data, timestamp: Date.now() });
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

  async loadFromIndexedDB() {
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
        const getRequest = store.get('media-data');
        
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

  async saveToLocalStorage(data) {
    try {
      localStorage.setItem('media-library-data', JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      throw new Error('Failed to save to localStorage: ' + error.message);
    }
  }

  async loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('media-library-data');
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
      
      if (!db.objectStoreNames.contains('media')) {
        console.warn('Media object store does not exist, nothing to clear');
        return;
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => {
          console.error('Failed to clear IndexedDB:', clearRequest.error);
          reject(clearRequest.error);
        };
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
}

export { BrowserStorage };
