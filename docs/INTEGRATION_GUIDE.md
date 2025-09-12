# Media Library Integration Guide

This guide explains how to integrate the decoupled Media Library component with your application using external data sources.

## Overview

The Media Library has been refactored to use a clean, decoupled architecture where:

- **Core Component**: Handles media display, filtering, and interaction
- **Data Sources**: External modules that provide page lists from various sources
- **Integration Layer**: Your application code that connects data sources to the component

## Quick Start

### 1. Include the Media Library

```html
<!-- Include the core component -->
<script type="module" src="media-library.es.js"></script>

<!-- Include data sources -->
<script type="module" src="sources/index.js"></script>
```

### 2. Basic Integration

```html
<media-library id="my-media-library" storage="indexeddb" locale="en"></media-library>

<script type="module">
import { SitemapSource } from './sources/index.js';

const mediaLibrary = document.getElementById('my-media-library');
const sitemapSource = new SitemapSource();

// Scan a website
async function scanWebsite(url) {
    try {
        // Get page list from sitemap
        const pageList = await sitemapSource.getPageList(url);
        
        // Load pages into media library
        const mediaData = await mediaLibrary.loadFromPageList(
            pageList, 
            (completed, total, found) => {
                console.log(`Progress: ${completed}/${total} pages, ${found} media items`);
            },
            'my-site-key'
        );
        
        console.log(`Found ${mediaData.length} media items`);
    } catch (error) {
        console.error('Scan failed:', error);
    }
}

// Usage
scanWebsite('https://example.com');
</script>
```

## Core API Methods

### `loadFromPageList(pageList, onProgress, siteKey)`

Loads media data from a list of pages.

**Parameters:**
- `pageList` (Array): Array of page objects with `url`, `lastmod`, etc.
- `onProgress` (Function, optional): Progress callback `(completed, total, found) => void`
- `siteKey` (String, optional): Storage key for the data

**Returns:** Promise<Array> - Array of media data

### `loadFromStorage(siteKey)`

Loads previously saved media data from storage.

**Parameters:**
- `siteKey` (String): Storage key to load

**Returns:** Promise<Array> - Array of media data

### `clearData()`

Clears all media data from the component.

### `generateSiteKey(source)`

Generates a storage key from a source URL.

**Parameters:**
- `source` (String): Source URL or identifier

**Returns:** String - Generated site key

## Available Data Sources

### Sitemap Source

Discovers and parses XML sitemaps.

```javascript
import { SitemapSource } from './sources/index.js';

const source = new SitemapSource();

// Auto-detect sitemap
const pageList = await source.getPageList('https://example.com');

// Use specific sitemap URL
const pageList = await source.getPageList('https://example.com', 'https://example.com/sitemap.xml');
```

### WordPress Source

Uses WordPress REST API to discover content.

```javascript
import { WordPressSource } from './sources/index.js';

const source = new WordPressSource();

const pageList = await source.getPageList('https://your-wordpress-site.com', {
    postTypes: ['posts', 'pages'],
    perPage: 100,
    maxPages: 10
});

// Get media library items directly
const mediaItems = await source.getMediaList('https://your-wordpress-site.com', {
    perPage: 100,
    maxPages: 10
});
```

### AEM Source

Uses Adobe Experience Manager GraphQL API.

```javascript
import { AEMSource } from './sources/index.js';

const source = new AEMSource();

const pageList = await source.getPageList('https://your-aem-site.com', {
    graphqlEndpoint: '/content/cq:graphql/endpoint.json',
    maxResults: 1000,
    contentPath: '/content'
});
```

### Adobe Dynamic Assets Source

Uses Adobe Dynamic Media API.

```javascript
import { AdobeDASource } from './sources/index.js';

const source = new AdobeDASource();

const pageList = await source.getPageList('https://your-company.scene7.com', {
    apiKey: 'your-api-key',
    companyId: 'your-company-id',
    maxResults: 1000,
    assetTypes: ['image', 'video']
});
```

## Multi-Source Integration

You can combine multiple data sources to create a comprehensive media library:

```javascript
import { SitemapSource, WordPressSource } from './sources/index.js';

const mediaLibrary = document.getElementById('my-media-library');
const sitemapSource = new SitemapSource();
const wordpressSource = new WordPressSource();

async function scanMultipleSources() {
    const allPages = [];
    
    // Scan sitemap
    const sitemapPages = await sitemapSource.getPageList('https://example.com');
    allPages.push(...sitemapPages);
    
    // Scan WordPress
    const wpPages = await wordpressSource.getPageList('https://wp.example.com');
    allPages.push(...wpPages);
    
    // Load all pages into media library
    const mediaData = await mediaLibrary.loadFromPageList(allPages);
    
    console.log(`Total: ${mediaData.length} media items from ${allPages.length} pages`);
}
```

## Custom Data Source

Create your own data source by implementing the required methods:

```javascript
class CustomSource {
    constructor() {
        this.name = 'Custom Source';
        this.description = 'My custom data source';
    }
    
    canHandle(url) {
        // Return true if this source can handle the URL
        return url.includes('my-custom-pattern');
    }
    
    async getPageList(url, options = {}) {
        // Return array of page objects
        return [
            {
                url: 'https://example.com/page1',
                loc: 'https://example.com/page1',
                lastmod: '2024-01-01T00:00:00Z',
                title: 'Page 1'
            }
        ];
    }
}

// Usage
const customSource = new CustomSource();
const pageList = await customSource.getPageList('https://my-custom-site.com');
const mediaData = await mediaLibrary.loadFromPageList(pageList);
```

## Error Handling

All data sources and the media library component include comprehensive error handling:

```javascript
try {
    const pageList = await source.getPageList(url);
    const mediaData = await mediaLibrary.loadFromPageList(pageList);
} catch (error) {
    if (error.message.includes('CORS')) {
        console.error('CORS error - try using a different approach');
    } else if (error.message.includes('Failed to fetch')) {
        console.error('Network error - check URL and connectivity');
    } else {
        console.error('Unexpected error:', error.message);
    }
}
```

## Storage Management

The media library supports different storage backends:

```javascript
// Use IndexedDB (recommended)
<media-library storage="indexeddb"></media-library>

// Use Local Storage
<media-library storage="local"></media-library>

// Load from specific site
await mediaLibrary.loadFromStorage('my-site-key');

// Clear all data
mediaLibrary.clearData();
```

## Best Practices

1. **Use appropriate data sources** for your content type
2. **Handle errors gracefully** with try-catch blocks
3. **Provide progress feedback** to users during long scans
4. **Use meaningful site keys** for storage organization
5. **Test with different storage types** for compatibility
6. **Implement fallback strategies** when primary sources fail

## Examples

See the `examples/` directory for complete integration examples:

- `basic-sitemap.html` - Simple sitemap integration
- `wordpress-integration.html` - WordPress REST API integration
- `multi-source-integration.html` - Multiple data sources
- `aem-integration.html` - Adobe Experience Manager integration
- `adobe-da-integration.html` - Adobe Dynamic Assets integration

## Troubleshooting

### Common Issues

1. **CORS Errors**: Some sites block cross-origin requests. Use server-side proxies or different data sources.

2. **Rate Limiting**: Some APIs have rate limits. Implement delays between requests.

3. **Large Datasets**: For large sites, consider pagination and incremental loading.

4. **Storage Limits**: Browser storage has limits. Monitor usage and implement cleanup strategies.

### Debug Mode

Enable debug logging:

```javascript
// Set debug mode in browser console
localStorage.setItem('media-library-debug', 'true');
```

## Support

For issues and questions:

1. Check the examples in the `examples/` directory
2. Review the API reference documentation
3. Check browser console for error messages
4. Verify data source compatibility with your URLs
