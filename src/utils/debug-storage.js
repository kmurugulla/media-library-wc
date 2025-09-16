import BrowserStorage from './storage.js';
import logger from './logger.js';

class StorageDebugger {
  constructor() {
    this.storage = new BrowserStorage('indexeddb');
  }

  isIndexedDBSupported() {
    return 'indexedDB' in window;
  }

  async listDatabases() {
    if (!this.isIndexedDBSupported()) {
      logger.warn('IndexedDB is not supported');
      return [];
    }

    try {
      const db = await this.storage.ensureDatabase();
      logger.info('Database opened successfully:', db.name, 'version:', db.version);
      logger.info('Object stores:', Array.from(db.objectStoreNames));
      return Array.from(db.objectStoreNames);
    } catch (error) {
      logger.error('Failed to open database:', error);
      return [];
    }
  }

  async checkMediaStore() {
    try {
      const db = await this.storage.ensureDatabase();
      const hasMediaStore = db.objectStoreNames.contains('media');
      logger.info('Media object store exists:', hasMediaStore);
      return hasMediaStore;
    } catch (error) {
      logger.error('Failed to check media store:', error);
      return false;
    }
  }

  async testStorage() {
    logger.info('Testing storage operations...');

    try {
      const testData = [{ id: 'test', name: 'test-file.jpg', url: 'test.jpg' }];
      await this.storage.save(testData);
      logger.info('✓ Save operation successful');

      const loadedData = await this.storage.load();
      logger.info('✓ Load operation successful, data:', loadedData);

      await this.storage.clear();
      logger.info('✓ Clear operation successful');

      return true;
    } catch (error) {
      logger.error('✗ Storage test failed:', error);
      return false;
    }
  }

  async resetDatabase() {
    try {
      await this.storage.resetDatabase();
      logger.info('✓ Database reset successful');
      return true;
    } catch (error) {
      logger.error('✗ Database reset failed:', error);
      return false;
    }
  }

  async runDiagnostics() {
    logger.info('=== Storage Diagnostics ===');

    logger.info('1. IndexedDB Support:', this.isIndexedDBSupported());

    logger.info('2. Database Info:');
    await this.listDatabases();

    logger.info('3. Media Store Check:');
    await this.checkMediaStore();

    logger.info('4. Storage Operations Test:');
    await this.testStorage();

    logger.info('=== Diagnostics Complete ===');
  }
}

export default StorageDebugger;

if (typeof window !== 'undefined') {
  window.StorageDebugger = StorageDebugger;
  window.debugStorage = new StorageDebugger();
}
