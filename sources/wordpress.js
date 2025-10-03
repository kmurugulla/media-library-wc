/**
 * WordPress Data Source
 * Provides page lists from WordPress REST API for the Media Library component
 */

class WordPressSource {
  constructor() {
    this.name = 'WordPress Source';
    this.description = 'Discovers pages and posts via WordPress REST API';
  }

  /**
   * Check if the source can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this source can handle the URL
   */
  canHandle(url) {
    if (!url) return false;

    const wordpressPatterns = [
      /\/wp-json\/wp\/v2\//,
      /\/wp-admin\//,
      /\/wp-content\//,
      /\/wp-includes\//,
    ];

    return wordpressPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Get page list from WordPress REST API
   * @param {string} baseUrl - WordPress site base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of page objects
   */
  async getPageList(baseUrl, options = {}) {
    if (!this.canHandle(baseUrl)) {
      throw new Error('Invalid WordPress URL');
    }

    const {
      postTypes = ['posts', 'pages'],
      perPage = 100,
      maxPages = 10,
    } = options;

    const pages = [];
    const baseApiUrl = this.getApiBaseUrl(baseUrl);

    for (const postType of postTypes) {
      try {
        const typePages = await this.fetchPostTypePages(baseApiUrl, postType, perPage, maxPages);
        pages.push(...typePages);
      } catch (error) {
        // Ignore errors for individual post types
      }
    }

    return pages;
  }

  /**
   * Get WordPress REST API base URL
   * @param {string} baseUrl - WordPress site URL
   * @returns {string} API base URL
   */
  getApiBaseUrl(baseUrl) {
    const cleanUrl = baseUrl.replace(/\/$/, '');

    if (cleanUrl.includes('/wp-json/wp/v2')) {
      return cleanUrl.replace(/\/wp-json\/wp\/v2.*$/, '/wp-json/wp/v2');
    }

    return `${cleanUrl}/wp-json/wp/v2`;
  }

  /**
   * Fetch pages for a specific post type
   * @param {string} apiBaseUrl - API base URL
   * @param {string} postType - Post type (posts, pages, etc.)
   * @param {number} perPage - Items per page
   * @param {number} maxPages - Maximum pages to fetch
   * @returns {Promise<Array>} Array of page objects
   */
  async fetchPostTypePages(apiBaseUrl, postType, perPage, maxPages) {
    const pages = [];
    let currentPage = 1;

    while (currentPage <= maxPages) {
      try {
        const url = `${apiBaseUrl}/${postType}?per_page=${perPage}&page=${currentPage}&_fields=id,link,modified,title,type`;
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 404) {
            break;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        const typePages = data.map((post) => ({
          url: post.link,
          loc: post.link,
          lastmod: post.modified,
          title: post.title?.rendered || post.title,
          type: post.type,
          id: post.id,
        }));

        pages.push(...typePages);
        currentPage += 1;

        if (data.length < perPage) {
          break;
        }
      } catch (error) {
        break;
      }
    }

    return pages;
  }

  /**
   * Get media items directly from WordPress REST API
   * @param {string} baseUrl - WordPress site base URL
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of media objects
   */
  async getMediaList(baseUrl, options = {}) {
    const {
      perPage = 100,
      maxPages = 10,
    } = options;

    const mediaItems = [];
    const apiBaseUrl = this.getApiBaseUrl(baseUrl);
    let currentPage = 1;

    while (currentPage <= maxPages) {
      try {
        const url = `${apiBaseUrl}/media?per_page=${perPage}&page=${currentPage}&_fields=id,link,source_url,title,alt_text,media_type,mime_type,date_modified`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        const items = data.map((media) => ({
          url: media.source_url,
          link: media.link,
          title: media.title?.rendered || media.title,
          alt: media.alt_text,
          type: media.media_type,
          mimeType: media.mime_type,
          lastmod: media.date_modified,
          id: media.id,
        }));

        mediaItems.push(...items);
        currentPage += 1;

        if (data.length < perPage) {
          break;
        }
      } catch (error) {
        break;
      }
    }

    return mediaItems;
  }
}

export default WordPressSource;
