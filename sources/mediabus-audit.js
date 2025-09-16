/**
 * Media-Bus Audit Log Data Source
 * Loads media data from AEM Media-Bus audit logs via Admin API
 */

class MediaBusAuditSource {
  constructor() {
    this.name = 'Media-Bus Audit Source';
    this.description = 'Loads media data from AEM Media-Bus audit logs';
    this.requireAuth = true;
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;

    const mediaBusPatterns = [
      /\/medialog/,
      /\/api\/audit-logs/,
      /\/mediabus\/audit/,
      /admin\.hlx\.page.*medialog/,
    ];

    return mediaBusPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Get media data from Media-Bus audit logs
   * @param {string} baseUrl - Base URL (can be org/repo format or direct URL)
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of media data objects
   */
  async getMediaData(baseUrl, options = {}) {
    const {
      org,
      repo,
      requireAuth = true,
    } = options;

    if (org && repo) {
      return this.getMediaDataFromAEM(org, repo, options);
    }

    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid Media-Bus URL');
    }

    if (requireAuth) {
      try {
        return this.getMediaDataFromAuditAPI(baseUrl, options);
      } catch (error) {
        console.warn('Audit API failed:', error.message);
        throw error;
      }
    }

    throw new Error('Authentication required for Media-Bus audit logs');
  }

  /**
   * Get media data from AEM using org/repo format
   * @param {string} org - AEM organization
   * @param {string} repo - AEM repository
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of media data objects
   */
  async getMediaDataFromAEM(org, repo, options = {}) {
    try {
      const isAuthenticated = await this.checkAuthentication(org, repo);
      if (!isAuthenticated) {
        throw new Error('Authentication required. Please authenticate with AEM first.');
      }

      const auditLogUrl = `https://admin.hlx.page/medialog/${org}/${repo}/main`;

      const auditLogs = await this.fetchAuditLogs(auditLogUrl, options);

      return this.convertAuditLogsToMediaData(auditLogs, options);
    } catch (error) {
      throw new Error(`Media-Bus audit scan failed: ${error.message}`);
    }
  }

  /**
   * Get media data from direct audit API
   * @param {string} auditLogUrl - Direct audit log API URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of media data objects
   */
  async getMediaDataFromAuditAPI(auditLogUrl, options = {}) {
    try {
      const auditLogs = await this.fetchAuditLogs(auditLogUrl, options);

      return this.convertAuditLogsToMediaData(auditLogs, options);
    } catch (error) {
      throw new Error(`Audit API scan failed: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated for the given org/repo
   * @param {string} org - Organization
   * @param {string} repo - Repository
   * @returns {Promise<boolean>} True if authenticated
   */
  async checkAuthentication(org, repo) {
    try {
      if (window.messageSidekick) {
        const authInfo = await new Promise((resolve) => {
          window.messageSidekick({ action: 'getAuthInfo' }, (res) => resolve(res));
          setTimeout(() => resolve(null), 200);
        });

        if (authInfo && Array.isArray(authInfo) && authInfo.includes(org)) {
          return true;
        }
      }

      const statusUrl = `https://admin.hlx.page/status/${org}/${repo}/main/*`;
      const response = await fetch(statusUrl, {
        method: 'HEAD',
        mode: 'cors',
        credentials: 'same-origin',
      });

      return response.ok;
    } catch (error) {
      console.warn('Authentication check failed:', error.message);
      return false;
    }
  }

  /**
   * Fetch audit logs from API
   * @param {string} auditLogUrl - Audit log API URL
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of audit log entries
   */
  async fetchAuditLogs(auditLogUrl, options = {}) {
    const {
      startDate,
      endDate,
      operation = 'all',
      limit = 1000,
    } = options;

    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (operation !== 'all') queryParams.append('operation', operation);
    if (limit) queryParams.append('limit', limit);

    const url = `${auditLogUrl}?${queryParams}`;

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit logs: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.logs && Array.isArray(result.logs)) {
      return result.logs;
    } if (Array.isArray(result)) {
      return result;
    } if (result.data && Array.isArray(result.data)) {
      return result.data;
    }

    throw new Error('Invalid audit log response format');
  }

  /**
   * Convert audit logs to media data format
   * @param {Array} auditLogs - Array of audit log entries
   * @param {Object} options - Conversion options
   * @returns {Array} Array of media data objects
   */
  convertAuditLogsToMediaData(auditLogs, options = {}) {
    const {
      mediaBaseUrl = 'https://media.example.com',
      org,
      repo,
    } = options;

    const mediaMap = new Map();

    auditLogs.forEach((logEntry) => {
      let parsedEntry;

      if (typeof logEntry === 'string') {
        parsedEntry = this.parseSpaceSeparatedLog(logEntry);
      } else if (typeof logEntry === 'object') {
        parsedEntry = this.parseJsonLog(logEntry);
      }
      if (!parsedEntry) {
        console.warn('Unknown log entry format:', logEntry);
        return;
      }

      const {
        timestamp,
        operation,
        mediaHash,
        contentType,
        user,
        path,
        filename,
        sourceType,
      } = parsedEntry;

      const mediaUrl = this.buildMediaUrl(mediaHash, contentType, mediaBaseUrl, org, repo);

      const mediaKey = mediaHash;

      if (!mediaMap.has(mediaKey)) {
        mediaMap.set(mediaKey, {
          url: mediaUrl,
          name: filename || 'unknown',
          alt: 'null',
          type: this.mapContentTypeToType(contentType),
          doc: path || '/',
          ctx: sourceType || 'audit-log',
          hash: mediaHash,
          firstUsedAt: new Date(timestamp).getTime(),
          lastUsedAt: new Date(timestamp).getTime(),
          contentType,
          user,
          contentSourceType: sourceType || 'audit-log',
          usageCount: 0,
          usageHistory: [],
        });
      }

      const mediaItem = mediaMap.get(mediaKey);
      mediaItem.usageCount += 1;
      mediaItem.usageHistory.push({
        operation,
        timestamp: new Date(timestamp).getTime(),
        user,
        path,
        sourceType,
      });

      const logTime = new Date(timestamp).getTime();
      if (logTime > mediaItem.lastUsedAt) {
        mediaItem.lastUsedAt = logTime;
      }
    });

    return Array.from(mediaMap.values());
  }

  /**
   * Parse space-separated log entry (from GitHub issue format)
   * @param {string} logEntry - Space-separated log entry
   * @returns {Object|null} Parsed log entry
   */
  parseSpaceSeparatedLog(logEntry) {
    const parts = logEntry.split(' ');
    if (parts.length < 8) {
      console.warn('Invalid log entry format:', logEntry);
      return null;
    }

    return {
      timestamp: parts[0],
      operation: parts[1],
      mediaHash: parts[2],
      contentType: parts[3],
      user: parts[4],
      path: parts[5],
      filename: parts[6],
      sourceType: parts[7],
    };
  }

  /**
   * Parse JSON log entry
   * @param {Object} logEntry - JSON log entry
   * @returns {Object|null} Parsed log entry
   */
  parseJsonLog(logEntry) {
    return {
      timestamp: logEntry.timestamp || logEntry.time || logEntry.date,
      operation: logEntry.operation || logEntry.action || logEntry.type,
      mediaHash: logEntry.mediaHash || logEntry.hash || logEntry.media_id,
      contentType: logEntry.contentType || logEntry.mimeType || logEntry.type,
      user: logEntry.user || logEntry.userId || logEntry.email,
      path: logEntry.path || logEntry.document || logEntry.page,
      filename: logEntry.filename || logEntry.name || logEntry.originalFilename,
      sourceType: logEntry.sourceType || logEntry.contentSourceType || logEntry.source,
    };
  }

  /**
   * Build media URL from hash and content type
   * @param {string} mediaHash - Media hash
   * @param {string} contentType - Content type
   * @param {string} mediaBaseUrl - Base URL for media
   * @param {string} org - Organization (optional)
   * @param {string} repo - Repository (optional)
   * @returns {string} Media URL
   */
  buildMediaUrl(mediaHash, contentType, mediaBaseUrl, org, repo) {
    const extension = this.getExtensionFromContentType(contentType);

    if (org && repo) {
      return `${mediaBaseUrl}/${org}/${repo}/${mediaHash}${extension}`;
    }

    return `${mediaBaseUrl}/${mediaHash}${extension}`;
  }

  /**
   * Get file extension from content type
   * @param {string} contentType - MIME type
   * @returns {string} File extension
   */
  getExtensionFromContentType(contentType) {
    const mimeToExt = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
    };

    return mimeToExt[contentType] || '';
  }

  /**
   * Map content type to media library type
   * @param {string} contentType - MIME type
   * @returns {string} Media library type
   */
  mapContentTypeToType(contentType) {
    if (contentType.startsWith('image/')) {
      const ext = this.getExtensionFromContentType(contentType);
      return `img > ${ext.substring(1)}`;
    }
    if (contentType.startsWith('video/')) {
      const ext = this.getExtensionFromContentType(contentType);
      return `video > ${ext.substring(1)}`;
    }
    if (contentType === 'application/pdf') {
      return 'link > pdf';
    }

    return 'other';
  }
}

export default MediaBusAuditSource;
