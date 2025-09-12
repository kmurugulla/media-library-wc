# Custom Data Source Development Guide

This guide explains how to create custom data sources for the Media Library component.

## Overview

Custom data sources allow you to integrate the Media Library with your specific content management system, API, or data source. This guide provides step-by-step instructions for creating, testing, and integrating custom data sources.

## Getting Started

### Prerequisites

- Basic JavaScript knowledge
- Understanding of async/await and Promises
- Familiarity with your target API or data source
- Access to the Media Library component

### Project Structure

```
your-project/
├── sources/
│   ├── index.js              # Data source registry
│   ├── sitemap.js            # Built-in sources
│   ├── wordpress.js
│   └── my-custom.js          # Your custom source
├── examples/
│   └── custom-integration.html
└── docs/
    └── CUSTOM_SOURCE_GUIDE.md
```

## Step 1: Create the Data Source Class

### Basic Structure

Create a new file for your custom data source:

```javascript
// sources/my-custom.js

class MyCustomSource {
    constructor() {
        this.name = 'My Custom Source';
        this.description = 'Custom data source for my CMS';
    }
    
    canHandle(url) {
        // Determine if this source can handle the URL
        return url.includes('my-cms.com') || url.includes('my-api.com');
    }
    
    async getPageList(url, options = {}) {
        // Fetch and return page list
        const pages = [];
        
        // Your implementation here
        
        return pages;
    }
}

export default MyCustomSource;
```

### Required Methods

#### `canHandle(url)`

This method determines whether your data source can handle a given URL.

```javascript
canHandle(url) {
    if (!url) return false;
    
    // Check for specific domain patterns
    const patterns = [
        /my-cms\.com$/,
        /my-api\.com/,
        /localhost:3000/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}
```

#### `getPageList(url, options)`

This method fetches the page list from your data source.

```javascript
async getPageList(url, options = {}) {
    const {
        maxResults = 1000,
        contentType = 'all',
        includeMedia = true
    } = options;
    
    try {
        // Fetch data from your API
        const response = await fetch(`${url}/api/pages`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Convert to page objects
        return data.pages.map(page => ({
            url: page.url,
            loc: page.url,
            lastmod: page.updatedAt,
            title: page.title,
            type: page.contentType,
            id: page.id
        }));
        
    } catch (error) {
        throw new Error(`Failed to fetch pages: ${error.message}`);
    }
}
```

## Step 2: Implement Error Handling

### Comprehensive Error Handling

```javascript
async getPageList(url, options = {}) {
    try {
        // Validate input
        if (!url) {
            throw new Error('URL is required');
        }
        
        if (!this.canHandle(url)) {
            throw new Error(`URL ${url} is not supported by this data source`);
        }
        
        // Make API request
        const response = await fetch(this.buildApiUrl(url, options), {
            method: 'GET',
            headers: this.buildHeaders(options),
            timeout: options.timeout || 30000
        });
        
        // Handle different response types
        if (response.status === 401) {
            throw new Error('Authentication failed. Please check your API key.');
        } else if (response.status === 403) {
            throw new Error('Access forbidden. You may not have permission to access this resource.');
        } else if (response.status === 404) {
            throw new Error('API endpoint not found. Please check the URL.');
        } else if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate response data
        if (!data || !Array.isArray(data.pages)) {
            throw new Error('Invalid response format from API');
        }
        
        return this.parsePages(data.pages, options);
        
    } catch (error) {
        // Provide user-friendly error messages
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error(`Network error: Unable to connect to ${url}. Please check your internet connection.`);
        } else if (error.name === 'AbortError') {
            throw new Error('Request timeout. The server took too long to respond.');
        } else {
            throw error;
        }
    }
}
```

### Helper Methods

```javascript
buildApiUrl(baseUrl, options) {
    const url = new URL(`${baseUrl}/api/pages`);
    
    if (options.maxResults) {
        url.searchParams.set('limit', options.maxResults);
    }
    
    if (options.contentType && options.contentType !== 'all') {
        url.searchParams.set('type', options.contentType);
    }
    
    if (options.includeMedia) {
        url.searchParams.set('include_media', 'true');
    }
    
    return url.toString();
}

buildHeaders(options) {
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'MediaLibrary/1.0'
    };
    
    if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
    
    if (options.apiToken) {
        headers['X-API-Token'] = options.apiToken;
    }
    
    return headers;
}

parsePages(pages, options) {
    return pages.map(page => ({
        url: page.url || page.permalink,
        loc: page.url || page.permalink,
        lastmod: page.updatedAt || page.modified || page.lastModified,
        title: page.title || page.name,
        type: page.contentType || page.type,
        id: page.id,
        // Add custom fields
        author: page.author,
        tags: page.tags,
        category: page.category
    }));
}
```

## Step 3: Add Configuration Options

### Configuration Schema

```javascript
class MyCustomSource {
    constructor() {
        this.name = 'My Custom Source';
        this.description = 'Custom data source for my CMS';
        this.defaultOptions = {
            maxResults: 1000,
            contentType: 'all',
            includeMedia: true,
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000
        };
    }
    
    getConfigurationSchema() {
        return {
            apiKey: {
                type: 'string',
                required: true,
                description: 'API key for authentication',
                placeholder: 'Enter your API key'
            },
            maxResults: {
                type: 'number',
                required: false,
                default: 1000,
                min: 1,
                max: 10000,
                description: 'Maximum number of pages to fetch'
            },
            contentType: {
                type: 'select',
                required: false,
                default: 'all',
                options: [
                    { value: 'all', label: 'All Content' },
                    { value: 'pages', label: 'Pages Only' },
                    { value: 'posts', label: 'Posts Only' },
                    { value: 'media', label: 'Media Only' }
                ],
                description: 'Type of content to fetch'
            },
            includeMedia: {
                type: 'boolean',
                required: false,
                default: true,
                description: 'Include media attachments'
            }
        };
    }
}
```

### Validation

```javascript
validateOptions(options) {
    const errors = [];
    
    if (!options.apiKey) {
        errors.push('API key is required');
    }
    
    if (options.maxResults && (options.maxResults < 1 || options.maxResults > 10000)) {
        errors.push('maxResults must be between 1 and 10000');
    }
    
    if (options.timeout && (options.timeout < 1000 || options.timeout > 60000)) {
        errors.push('timeout must be between 1000 and 60000 milliseconds');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
}
```

## Step 4: Implement Advanced Features

### Pagination Support

```javascript
async getPageList(url, options = {}) {
    const allPages = [];
    let currentPage = 1;
    const maxPages = options.maxPages || 10;
    
    while (currentPage <= maxPages) {
        try {
            const response = await fetch(`${url}/api/pages?page=${currentPage}&limit=100`, {
                headers: this.buildHeaders(options)
            });
            
            if (!response.ok) break;
            
            const data = await response.json();
            
            if (!data.pages || data.pages.length === 0) {
                break; // No more pages
            }
            
            allPages.push(...this.parsePages(data.pages, options));
            currentPage++;
            
            // Check if we've reached the maximum results
            if (options.maxResults && allPages.length >= options.maxResults) {
                break;
            }
            
        } catch (error) {
            console.warn(`Failed to fetch page ${currentPage}:`, error.message);
            break;
        }
    }
    
    return allPages.slice(0, options.maxResults);
}
```

### Caching

```javascript
class MyCustomSource {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    getCacheKey(url, options) {
        return `${url}:${JSON.stringify(options)}`;
    }
    
    getFromCache(url, options) {
        const key = this.getCacheKey(url, options);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        return null;
    }
    
    setCache(url, options, data) {
        const key = this.getCacheKey(url, options);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    async getPageList(url, options = {}) {
        // Check cache first
        const cached = this.getFromCache(url, options);
        if (cached) {
            return cached;
        }
        
        // Fetch fresh data
        const pages = await this.fetchPages(url, options);
        
        // Cache the result
        this.setCache(url, options, pages);
        
        return pages;
    }
}
```

### Retry Logic

```javascript
async fetchWithRetry(url, options, retryAttempts = 3) {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (attempt === retryAttempts) {
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => 
                setTimeout(resolve, options.retryDelay || 1000 * attempt)
            );
        }
    }
}
```

## Step 5: Register Your Data Source

### Add to Registry

```javascript
// sources/index.js
import MyCustomSource from './my-custom.js';

export const dataSources = {
    // ... existing sources
    'my-custom': {
        class: MyCustomSource,
        name: 'My Custom Source',
        description: 'Custom data source for my CMS',
        supportedTypes: ['my-cms', 'my-api'],
        defaultOptions: {
            maxResults: 1000,
            contentType: 'all',
            includeMedia: true
        }
    }
};
```

### Auto-Detection

```javascript
// In your custom source class
canHandle(url) {
    if (!url) return false;
    
    // Check for your specific patterns
    const patterns = [
        /my-cms\.com$/,
        /my-api\.com/,
        /localhost:3000/,
        /\.mycompany\.com$/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}
```

## Step 6: Create Integration Example

### HTML Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Custom Data Source Integration</title>
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <div class="container">
        <h1>Custom Data Source Integration</h1>
        
        <div class="controls">
            <div class="control-group">
                <label for="api-url">API URL:</label>
                <input type="url" id="api-url" placeholder="https://my-cms.com/api">
            </div>
            <div class="control-group">
                <label for="api-key">API Key:</label>
                <input type="password" id="api-key" placeholder="Your API key">
            </div>
            <div class="control-group">
                <label for="max-results">Max Results:</label>
                <input type="number" id="max-results" value="1000" min="1" max="10000">
            </div>
            <button id="scan-btn">Scan Custom Source</button>
        </div>
        
        <div class="media-library-container">
            <media-library id="media-library" storage="indexeddb"></media-library>
        </div>
    </div>

    <script type="module">
        import MediaLibrary from '../media-library.es.js';
        import { MyCustomSource } from '../sources/index.js';
        
        const mediaLibrary = document.getElementById('media-library');
        const customSource = new MyCustomSource();
        
        document.getElementById('scan-btn').addEventListener('click', async () => {
            const apiUrl = document.getElementById('api-url').value;
            const apiKey = document.getElementById('api-key').value;
            const maxResults = parseInt(document.getElementById('max-results').value);
            
            try {
                const pageList = await customSource.getPageList(apiUrl, {
                    apiKey,
                    maxResults
                });
                
                const mediaData = await mediaLibrary.loadFromPageList(pageList);
                console.log(`Found ${mediaData.length} media items`);
                
            } catch (error) {
                console.error('Scan failed:', error);
            }
        });
    </script>
</body>
</html>
```

## Step 7: Testing

### Unit Tests

```javascript
// tests/my-custom-source.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MyCustomSource from '../sources/my-custom.js';

describe('MyCustomSource', () => {
    let source;
    
    beforeEach(() => {
        source = new MyCustomSource();
        vi.clearAllMocks();
    });
    
    describe('canHandle', () => {
        it('should handle supported URLs', () => {
            expect(source.canHandle('https://my-cms.com')).toBe(true);
            expect(source.canHandle('https://api.my-cms.com')).toBe(true);
        });
        
        it('should not handle unsupported URLs', () => {
            expect(source.canHandle('https://example.com')).toBe(false);
            expect(source.canHandle('')).toBe(false);
        });
    });
    
    describe('getPageList', () => {
        it('should fetch pages successfully', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({
                    pages: [
                        {
                            id: 1,
                            url: 'https://my-cms.com/page1',
                            title: 'Page 1',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            };
            
            global.fetch = vi.fn().mockResolvedValue(mockResponse);
            
            const pages = await source.getPageList('https://my-cms.com', {
                apiKey: 'test-key'
            });
            
            expect(pages).toHaveLength(1);
            expect(pages[0].url).toBe('https://my-cms.com/page1');
        });
        
        it('should handle API errors', async () => {
            const mockResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            };
            
            global.fetch = vi.fn().mockResolvedValue(mockResponse);
            
            await expect(source.getPageList('https://my-cms.com', {
                apiKey: 'invalid-key'
            })).rejects.toThrow('Authentication failed');
        });
    });
});
```

### Integration Tests

```javascript
// tests/integration.test.js
import { describe, it, expect } from 'vitest';
import MediaLibrary from '../media-library.es.js';
import { MyCustomSource } from '../sources/index.js';

describe('Custom Source Integration', () => {
    it('should integrate with Media Library', async () => {
        const mediaLibrary = new MediaLibrary();
        const customSource = new MyCustomSource();
        
        // Mock the API response
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                pages: [
                    {
                        id: 1,
                        url: 'https://my-cms.com/page1',
                        title: 'Test Page',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ]
            })
        });
        
        const pageList = await customSource.getPageList('https://my-cms.com', {
            apiKey: 'test-key'
        });
        
        const mediaData = await mediaLibrary.loadFromPageList(pageList);
        
        expect(mediaData).toBeDefined();
        expect(Array.isArray(mediaData)).toBe(true);
    });
});
```

## Step 8: Documentation

### API Documentation

```javascript
/**
 * My Custom Data Source
 * 
 * A custom data source for integrating with MyCMS API.
 * 
 * @example
 * ```javascript
 * import { MyCustomSource } from './sources/index.js';
 * 
 * const source = new MyCustomSource();
 * const pageList = await source.getPageList('https://my-cms.com', {
 *     apiKey: 'your-api-key',
 *     maxResults: 1000
 * });
 * ```
 */
class MyCustomSource {
    /**
     * Creates a new MyCustomSource instance.
     */
    constructor() {
        this.name = 'My Custom Source';
        this.description = 'Custom data source for my CMS';
    }
    
    /**
     * Determines if this source can handle the given URL.
     * 
     * @param {string} url - URL to check
     * @returns {boolean} True if this source can handle the URL
     * 
     * @example
     * ```javascript
     * const source = new MyCustomSource();
     * const canHandle = source.canHandle('https://my-cms.com');
     * console.log(canHandle); // true
     * ```
     */
    canHandle(url) {
        // Implementation
    }
    
    /**
     * Fetches page list from MyCMS API.
     * 
     * @param {string} url - Base URL of the MyCMS API
     * @param {Object} options - Configuration options
     * @param {string} options.apiKey - API key for authentication
     * @param {number} [options.maxResults=1000] - Maximum number of pages to fetch
     * @param {string} [options.contentType='all'] - Type of content to fetch
     * @param {boolean} [options.includeMedia=true] - Whether to include media attachments
     * @returns {Promise<Array<Object>>} Array of page objects
     * 
     * @throws {Error} When API request fails or returns invalid data
     * 
     * @example
     * ```javascript
     * const source = new MyCustomSource();
     * const pages = await source.getPageList('https://my-cms.com', {
     *     apiKey: 'your-api-key',
     *     maxResults: 500,
     *     contentType: 'pages'
     * });
     * ```
     */
    async getPageList(url, options = {}) {
        // Implementation
    }
}
```

## Best Practices

### 1. Error Handling
- Provide meaningful error messages
- Handle network errors gracefully
- Implement proper validation
- Log errors for debugging

### 2. Performance
- Implement caching when appropriate
- Use pagination for large datasets
- Set reasonable timeouts
- Limit concurrent requests

### 3. Security
- Validate all input parameters
- Sanitize URLs and data
- Handle authentication securely
- Don't expose sensitive information

### 4. Compatibility
- Test with different browsers
- Handle CORS issues
- Provide fallback mechanisms
- Support different data formats

### 5. Documentation
- Document all configuration options
- Provide usage examples
- Include error scenarios
- Update when APIs change

## Troubleshooting

### Common Issues

#### API Authentication
**Problem:** Authentication failures
**Solutions:**
- Verify API key format
- Check authentication headers
- Implement token refresh
- Use proper authentication flow

#### Rate Limiting
**Problem:** API rate limits exceeded
**Solutions:**
- Implement request delays
- Use pagination
- Cache results
- Request higher rate limits

#### Data Format Issues
**Problem:** Invalid response format
**Solutions:**
- Validate response structure
- Handle missing fields
- Implement data transformation
- Provide fallback values

#### Network Issues
**Problem:** Network connectivity problems
**Solutions:**
- Implement retry logic
- Use appropriate timeouts
- Handle CORS issues
- Provide offline fallbacks

### Debug Mode

Enable debug logging:

```javascript
// Set debug mode
localStorage.setItem('custom-source-debug', 'true');

// Your data source will now log detailed information
const pageList = await source.getPageList(url, options);
```

### Testing Checklist

- [ ] URL pattern matching works correctly
- [ ] API authentication is handled properly
- [ ] Error messages are user-friendly
- [ ] Pagination works for large datasets
- [ ] Caching improves performance
- [ ] Retry logic handles transient failures
- [ ] Configuration validation works
- [ ] Integration with Media Library works
- [ ] Documentation is complete and accurate
