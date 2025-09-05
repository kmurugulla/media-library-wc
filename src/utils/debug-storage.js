// src/utils/debug-storage.js
import { BrowserStorage } from './storage.js';

/**
 * Debug utility for IndexedDB storage issues
 * This can be used in the browser console to diagnose storage problems
 */
export class StorageDebugger {
  constructor() {
    this.storage = new BrowserStorage('indexeddb');
  }

  /**
   * Check if IndexedDB is supported
   */
  isIndexedDBSupported() {
    return 'indexedDB' in window;
  }

  /**
   * List all databases
   */
  async listDatabases() {
    if (!this.isIndexedDBSupported()) {
      console.log('IndexedDB is not supported');
      return [];
    }

    // Note: This is a simplified check - full database listing requires more complex implementation
    try {
      const db = await this.storage.ensureDatabase();
      console.log('Database opened successfully:', db.name, 'version:', db.version);
      console.log('Object stores:', Array.from(db.objectStoreNames));
      return Array.from(db.objectStoreNames);
    } catch (error) {
      console.error('Failed to open database:', error);
      return [];
    }
  }

  /**
   * Check if the media object store exists
   */
  async checkMediaStore() {
    try {
      const db = await this.storage.ensureDatabase();
      const hasMediaStore = db.objectStoreNames.contains('media');
      console.log('Media object store exists:', hasMediaStore);
      return hasMediaStore;
    } catch (error) {
      console.error('Failed to check media store:', error);
      return false;
    }
  }

  /**
   * Test basic storage operations
   */
  async testStorage() {
    console.log('Testing storage operations...');
    
    try {
      // Test save
      const testData = [{ id: 'test', name: 'test-file.jpg', url: 'test.jpg' }];
      await this.storage.save(testData);
      console.log('✓ Save operation successful');

      // Test load
      const loadedData = await this.storage.load();
      console.log('✓ Load operation successful, data:', loadedData);

      // Test clear
      await this.storage.clear();
      console.log('✓ Clear operation successful');

      return true;
    } catch (error) {
      console.error('✗ Storage test failed:', error);
      return false;
    }
  }

  /**
   * Reset the entire database
   */
  async resetDatabase() {
    try {
      await this.storage.resetDatabase();
      console.log('✓ Database reset successful');
      return true;
    } catch (error) {
      console.error('✗ Database reset failed:', error);
      return false;
    }
  }

  /**
   * Run all diagnostic checks
   */
  async runDiagnostics() {
    console.log('=== Storage Diagnostics ===');
    
    console.log('1. IndexedDB Support:', this.isIndexedDBSupported());
    
    console.log('2. Database Info:');
    await this.listDatabases();
    
    console.log('3. Media Store Check:');
    await this.checkMediaStore();
    
    console.log('4. Storage Operations Test:');
    await this.testStorage();
    
    console.log('=== Diagnostics Complete ===');
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.StorageDebugger = StorageDebugger;
  window.debugStorage = new StorageDebugger();
}
