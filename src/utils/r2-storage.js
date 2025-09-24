import R2API from './r2-api.js';
import logger from './logger.js';

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

class R2Storage {
  constructor(type = 'r2', siteKey = null) {
    this.type = type;
    this.siteKey = siteKey;
    this.mode = 'live';

    const apiUrl = import.meta.env.VITE_R2_API_URL || window.R2_API_URL;

    if (!apiUrl) {
      throw new Error('R2 API URL not configured. Please set VITE_R2_API_URL environment variable or R2_API_URL global variable.');
    }

    this.r2API = new R2API({ apiUrl });
  }

  async saveMediaUsages(mediaUsages, mode = 'live') {
    try {
      const batchSize = 100;
      const batches = chunkArray(mediaUsages, batchSize);

      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];

        try {
          await this.r2API.batchSave(batch, mode);

          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
        } catch (error) {
          logger.error(`Failed to save batch ${i + 1}:`, error);
          throw error;
        }
      }
    } catch (error) {
      logger.error('Failed to save media usages to R2:', error);
      throw error;
    }
  }

  async loadMediaUsages(mode = null) {
    const actualMode = mode === null ? this.mode : mode;
    try {
      const hashFiles = await this.r2API.listObjects(`${actualMode}/`);
      const jsonFiles = hashFiles.filter((filename) => filename.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return [];
      }

      const batchSize = 100;
      const batches = chunkArray(jsonFiles, batchSize);
      const mediaUsages = [];

      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];

        try {
          const batchResults = await this.r2API.batchLoad(batch);
          const validResults = batchResults.filter((result) => result !== null);
          mediaUsages.push(...validResults);

          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
        } catch (error) {
          logger.error(`Failed to load batch ${i + 1}:`, error);
        }
      }

      return mediaUsages;
    } catch (error) {
      logger.error('Failed to load media usages from R2:', error);
      return [];
    }
  }

  async loadMediaUsagesProgressive(mode = null, batchSize = 100, onProgress = null) {
    const actualMode = mode === null ? this.mode : mode;
    try {
      const hashFiles = await this.r2API.listObjects(`${actualMode}/`);
      const jsonFiles = hashFiles.filter((filename) => filename.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return [];
      }

      const mediaUsages = [];
      const batches = chunkArray(jsonFiles, batchSize);

      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];

        try {
          const batchResults = await this.r2API.batchLoad(batch);
          const validResults = batchResults.filter((result) => result !== null);
          mediaUsages.push(...validResults);

          if (onProgress) {
            onProgress(((i + 1) / batches.length) * 100);
          }

          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
        } catch (error) {
          logger.error(`Failed to load batch ${i + 1}:`, error);
        }
      }

      return mediaUsages;
    } catch (error) {
      logger.error('Failed to load media usages progressively from R2:', error);
      return [];
    }
  }

  async saveMediaUsage(mediaUsage, mode = 'live') {
    try {
      const filename = `${mediaUsage.hash}.json`;
      await this.r2API.putObject(`${mode}/${filename}`, mediaUsage);
    } catch (error) {
      logger.error('Failed to save media usage to R2:', error);
      throw error;
    }
  }

  async loadMediaUsage(hash, mode = 'live') {
    try {
      const filename = `${hash}.json`;
      return await this.r2API.getObject(`${mode}/${filename}`);
    } catch (error) {
      logger.error('Failed to load media usage from R2:', error);
      return null;
    }
  }

  async updateMediaUsage(hash, updatedUsage, mode = 'live') {
    try {
      const filename = `${hash}.json`;
      await this.r2API.putObject(`${mode}/${filename}`, updatedUsage);
    } catch (error) {
      logger.error('Failed to update media usage in R2:', error);
      throw error;
    }
  }

  async deleteMediaUsage(hash, mode = 'live') {
    try {
      const filename = `${hash}.json`;
      await this.r2API.deleteObject(`${mode}/${filename}`);
    } catch (error) {
      logger.error('Failed to delete media usage from R2:', error);
      throw error;
    }
  }

  async handleIncrementalChanges(changes, mode = 'live') {
    try {
      const operations = [];

      for (const usage of changes.addedUsages || []) {
        operations.push(this.saveMediaUsage(usage, mode));
      }

      for (const usage of changes.updatedUsages || []) {
        operations.push(this.updateMediaUsage(usage.hash, usage, mode));
      }

      for (const usage of changes.deletedUsages || []) {
        operations.push(this.deleteMediaUsage(usage.hash, mode));
      }

      await Promise.all(operations);
      logger.info(`Applied ${operations.length} incremental changes to ${mode} mode`);
    } catch (error) {
      logger.error('Failed to handle incremental changes in R2:', error);
      throw error;
    }
  }

  async getMediaUsagesByDocument(docPath, mode = 'live') {
    try {
      const allUsages = await this.loadMediaUsages(mode);
      return allUsages.filter((usage) => usage.doc === docPath);
    } catch (error) {
      logger.error('Failed to get media usages by document from R2:', error);
      return [];
    }
  }

  async getMediaUsagesByUrl(mediaUrl, mode = 'live') {
    try {
      const allUsages = await this.loadMediaUsages(mode);
      return allUsages.filter((usage) => {
        const baseUrl = usage.url.split(/[?#]/)[0];
        return baseUrl === mediaUrl;
      });
    } catch (error) {
      logger.error('Failed to get media usages by URL from R2:', error);
      return [];
    }
  }

  async getMediaUsageStats(mode = 'live') {
    try {
      const allUsages = await this.loadMediaUsages(mode);

      const stats = {
        totalUsages: allUsages.length,
        uniqueMedia: new Set(allUsages.map((u) => u.url.split(/[?#]/)[0])).size,
        uniqueDocuments: new Set(allUsages.map((u) => u.doc)).size,
        byType: {},
        byDocument: {},
      };

      allUsages.forEach((usage) => {
        const type = usage.type?.split(' > ')[0] || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      allUsages.forEach((usage) => {
        stats.byDocument[usage.doc] = (stats.byDocument[usage.doc] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get media usage stats from R2:', error);
      return {
        totalUsages: 0,
        uniqueMedia: 0,
        uniqueDocuments: 0,
        byType: {},
        byDocument: {},
      };
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  async getAllSites() {
    try {
      const modes = ['preview', 'edit', 'live', 'audit'];
      const allSites = new Map();

      for (const mode of modes) {
        const hashFiles = await this.r2API.listObjects(`${mode}/`);
        const jsonFiles = hashFiles.filter((filename) => filename.endsWith('.json'));

        if (jsonFiles.length > 0) {
          const batchSize = 50;
          const batches = chunkArray(jsonFiles, batchSize);

          for (const batch of batches) {
            try {
              const batchResults = await this.r2API.batchLoad(batch);

              for (const usage of batchResults) {
                if (usage && usage.doc) {
                  try {
                    const siteKey = new URL(usage.doc).hostname;

                    if (!allSites.has(siteKey)) {
                      allSites.set(siteKey, {
                        siteKey,
                        itemCount: 0,
                        timestamp: usage.firstUsedAt || Date.now(),
                      });
                    }

                    const site = allSites.get(siteKey);
                    site.itemCount += 1;

                    if (usage.firstUsedAt && usage.firstUsedAt < site.timestamp) {
                      site.timestamp = usage.firstUsedAt;
                    }
                  } catch (urlError) {
                    // Skip invalid URLs
                  }
                }
              }
            } catch (error) {
              logger.warn(`Failed to process batch for mode ${mode}:`, error);
            }
          }
        }
      }

      return Array.from(allSites.values()).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to get all sites from R2:', error);
      return [];
    }
  }

  async migrateFromIndexedDB(siteKey, mode = 'live') {
    try {
      const { default: BrowserStorage } = await import('./storage.js');
      const indexedDBStorage = new BrowserStorage('indexeddb', siteKey);
      const mediaUsages = await indexedDBStorage.load();

      await this.saveMediaUsages(mediaUsages, mode);
      logger.info(`Migrated ${mediaUsages.length} media usages to R2 ${mode} mode`);
    } catch (error) {
      logger.error('Failed to migrate from IndexedDB to R2:', error);
      throw error;
    }
  }

  async save(data) {
    return this.saveMediaUsages(data, this.mode);
  }

  async load() {
    return this.loadMediaUsages(this.mode);
  }

  async loadScanMetadata() {
    try {
      const allUsages = await this.loadMediaUsages(this.mode);
      const pageLastModified = {};

      for (const usage of allUsages) {
        if (usage.doc && usage.lastUsedAt) {
          pageLastModified[usage.doc] = new Date(usage.lastUsedAt).toISOString();
        }
      }

      return { pageLastModified };
    } catch (error) {
      logger.error('Failed to load scan metadata from R2:', error);
      return { pageLastModified: {} };
    }
  }

  async saveScanMetadata(metadata) {
    try {
      const metadataKey = `${this.mode}/scan-metadata.json`;
      await this.r2API.putObject(metadataKey, metadata);
    } catch (error) {
      logger.error('Failed to save scan metadata to R2:', error);
      throw error;
    }
  }

  async deleteSiteFromIndexedDB(siteKey) {
    try {
      const allUsages = await this.loadMediaUsages(this.mode);
      const siteUsages = allUsages.filter((usage) => {
        try {
          const usageSiteKey = new URL(usage.doc).hostname;
          return usageSiteKey === siteKey;
        } catch {
          return false;
        }
      });

      const operations = siteUsages.map((usage) => this.deleteMediaUsage(usage.hash, this.mode));

      await Promise.all(operations);
      logger.info(`Deleted ${siteUsages.length} media usages for site: ${siteKey}`);
    } catch (error) {
      logger.error('Failed to delete site from R2:', error);
      throw error;
    }
  }

  async clearAllSites() {
    try {
      const modes = ['preview', 'edit', 'live'];
      const operations = [];

      for (const mode of modes) {
        const hashFiles = await this.r2API.listObjects(`${mode}/`);
        for (const filename of hashFiles) {
          if (filename.endsWith('.json')) {
            operations.push(this.r2API.deleteObject(filename));
          }
        }
      }

      await Promise.all(operations);
      logger.info('Cleared all sites from R2');
    } catch (error) {
      logger.error('Failed to clear all sites from R2:', error);
      throw error;
    }
  }
}

export default R2Storage;
