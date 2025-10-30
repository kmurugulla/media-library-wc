// src/utils/ai-indexer.js
// AI Worker Integration - Handles communication with Cloudflare AI Agent Worker

class AIIndexer {
  constructor(workerUrl, apiKey = null) {
    this.workerUrl = workerUrl;
    this.apiKey = apiKey;
    this.enabled = !!workerUrl;
  }

  /**
   * Index media items to AI worker (D1 + Vectorize)
   * @param {Array} mediaItems - Media items to index
   * @param {string} siteKey - Site identifier (usually hostname)
   * @param {number} batchSize - Number of items per batch
   */
  async indexBatch(mediaItems, siteKey, batchSize = 500) {
    if (!this.enabled || !mediaItems || mediaItems.length === 0) {
      return { success: true, indexed: 0, message: 'AI indexing disabled or no items' };
    }

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 📤 indexBatch called for siteKey:', siteKey, 'items:', mediaItems.length);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      let totalIndexed = 0;

      // Process in chunks to respect API limits
      for (let i = 0; i < mediaItems.length; i += batchSize) {
        const chunk = mediaItems.slice(i, i + batchSize);

        const response = await fetch(`${this.workerUrl}/api/ai/index-batch`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            siteKey,
            batch: chunk.map((item) => ({
              hash: item.hash,
              url: item.url,
              doc: item.doc,
              type: item.type,
              alt: item.alt,
              width: item.width,
              height: item.height,
              orientation: item.orientation,
              category: item.category,
              loading: item.loading,
              fetchpriority: item.fetchpriority,
              isLazyLoaded: item.isLazyLoaded,
              role: item.role,
              ariaHidden: item.ariaHidden,
              parentTag: item.parentTag,
              hasFigcaption: item.hasFigcaption,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`AI indexing failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        totalIndexed += result.indexed || chunk.length;
      }

      return {
        success: true,
        indexed: totalIndexed,
        message: `Indexed ${totalIndexed} items to AI`,
      };
    } catch (error) {
      // Don't throw - AI indexing is optional and shouldn't break the flow
      // eslint-disable-next-line no-console
      console.warn('[AI Indexer] Failed to index media:', error.message);
      return {
        success: false,
        indexed: 0,
        error: error.message,
      };
    }
  }

  /**
   * Query AI for media search
   * @param {string} query - Natural language query
   * @param {string} siteKey - Site identifier
   */
  async query(queryText, siteKey) {
    if (!this.enabled) {
      throw new Error('AI indexer not enabled');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${this.workerUrl}/api/ai/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: queryText,
        siteKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI query failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get AI recommendations for specific image occurrence
   * @param {string} imageUrl - Image URL
   * @param {string} pageUrl - Page URL
   * @param {number} occurrence - Which occurrence on the page
   * @param {string} siteKey - Site identifier
   */
  async analyzeImage(imageUrl, pageUrl, occurrence, siteKey) {
    if (!this.enabled) {
      throw new Error('AI indexer not enabled');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(`${this.workerUrl}/api/ai/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageUrl,
        pageUrl,
        occurrence,
        siteKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Delete specific media items from AI worker
   * @param {Array<string>} hashes - Media item hashes to delete
   * @param {string} siteKey - Site identifier
   */
  async deleteBatch(hashes, siteKey) {
    if (!this.enabled || !hashes || hashes.length === 0) {
      return { success: true, deleted: 0, message: 'AI indexing disabled or no items' };
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(`${this.workerUrl}/api/ai/delete-batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          siteKey,
          hashes,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI deletion failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[AI Indexer] Failed to delete media:', error.message);
      return {
        success: false,
        deleted: 0,
        error: error.message,
      };
    }
  }

  /**
   * Clear all media items for a site from AI worker
   * @param {string} siteKey - Site identifier
   */
  async clearSite(siteKey) {
    if (!this.enabled) {
      return { success: true, deleted: 0, message: 'AI indexing disabled' };
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(`${this.workerUrl}/api/ai/clear-site`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ siteKey }),
      });

      if (!response.ok) {
        throw new Error(`AI clear site failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[AI Indexer] Failed to clear site:', error.message);
      return {
        success: false,
        deleted: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get count of media items for a site in AI worker
   * @param {string} siteKey - Site identifier
   */
  async getCount(siteKey) {
    if (!this.enabled) {
      return { count: 0 };
    }

    try {
      const headers = {};
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(`${this.workerUrl}/api/ai/count?siteKey=${encodeURIComponent(siteKey)}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`AI count failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[AI Indexer] Failed to get count:', error.message);
      return { count: 0, error: error.message };
    }
  }

  /**
   * Sync delta changes between old and new data
   * Calculates added/deleted items and syncs in parallel
   * @param {Array} oldData - Previous media items
   * @param {Array} newData - Current media items
   * @param {string} siteKey - Site identifier
   * @returns {Promise<{added: number, deleted: number}>}
   */
  async syncDelta(oldData, newData, siteKey) {
    if (!this.enabled) {
      return { added: 0, deleted: 0 };
    }

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 🔄 syncDelta called for siteKey:', siteKey);

    // Calculate deltas
    const oldHashes = new Set(oldData.map((item) => item.hash));
    const newHashes = new Set(newData.map((item) => item.hash));

    const itemsToAdd = newData.filter((item) => !oldHashes.has(item.hash));
    const hashesToDelete = Array.from(oldHashes).filter((hash) => !newHashes.has(hash));

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 📊 Delta calculated: +', itemsToAdd.length, 'items, -', hashesToDelete.length, 'items');

    // No changes, skip sync
    if (itemsToAdd.length === 0 && hashesToDelete.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[AI Indexer] ✅ No changes detected - skipping sync');
      return { added: 0, deleted: 0 };
    }

    // Sync in parallel
    const addPromise = itemsToAdd.length > 0
      ? this.indexBatch(itemsToAdd, siteKey)
      : Promise.resolve({ indexed: 0 });

    const deletePromise = hashesToDelete.length > 0
      ? this.deleteBatch(hashesToDelete, siteKey)
      : Promise.resolve({ deleted: 0 });

    const [addResult, deleteResult] = await Promise.all([addPromise, deletePromise]);

    return {
      added: addResult.indexed || 0,
      deleted: deleteResult.deleted || 0,
    };
  }

  /**
   * Check if sync needed and sync if count mismatch
   * @param {Array} localData - Current local media items
   * @param {string} siteKey - Site identifier
   * @returns {Promise<{synced: boolean, count: number}>}
   */
  async syncIfNeeded(localData, siteKey) {
    if (!this.enabled || !localData || localData.length === 0) {
      return { synced: false, count: 0 };
    }

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 🔍 syncIfNeeded called for siteKey:', siteKey, 'local items:', localData.length);

    // Check D1 count
    const countResult = await this.getCount(siteKey);
    const localCount = localData.length;
    const aiCount = countResult.count || 0;

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 📊 Count comparison: local =', localCount, ', AI =', aiCount);

    // Sync if D1 empty or count mismatch >10%
    const needsSync = aiCount === 0 || Math.abs(aiCount - localCount) > localCount * 0.1;

    if (!needsSync) {
      // eslint-disable-next-line no-console
      console.log('[AI Indexer] ✅ Sync not needed - counts match');
      return { synced: false, count: aiCount };
    }

    // eslint-disable-next-line no-console
    console.log('[AI Indexer] 🔄 Sync needed - performing full sync');

    // Full sync needed
    const result = await this.indexBatch(localData, siteKey);

    return {
      synced: true,
      count: result.indexed || 0,
    };
  }

  /**
   * Check if AI worker is available
   */
  async healthCheck() {
    if (!this.enabled) {
      return { available: false };
    }

    try {
      const response = await fetch(`${this.workerUrl}/api/health`);
      if (!response.ok) {
        return { available: false };
      }
      const data = await response.json();
      return { available: true, ...data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

/**
 * Create AI indexer instance from environment variables
 */
export function createAIIndexer() {
  // eslint-disable-next-line no-undef
  const enabled = typeof __AI_ENABLED__ !== 'undefined' && __AI_ENABLED__;
  if (!enabled) {
    return null;
  }

  // eslint-disable-next-line no-undef
  const workerUrl = typeof __AI_WORKER_URL__ !== 'undefined' ? __AI_WORKER_URL__ : '';
  // eslint-disable-next-line no-undef
  const apiKey = typeof __AI_API_KEY__ !== 'undefined' ? __AI_API_KEY__ : '';

  if (!workerUrl) {
    return null;
  }

  return new AIIndexer(workerUrl, apiKey);
}

export default AIIndexer;
