# Data Sources Documentation

This document provides detailed information about the available data sources and how to use them.

## Overview

Data sources are external modules that provide page lists to the Media Library component. Each data source is designed to work with specific types of content management systems or APIs.

## Available Data Sources

### 1. Sitemap Source

**File:** `sources/sitemap.js`

**Purpose:** Discovers and parses XML sitemaps to extract page lists.

**Best For:**
- Standard websites with XML sitemaps
- SEO-friendly sites
- Sites that follow sitemap protocols

**Features:**
- Auto-detection of sitemap URLs
- Support for sitemap indexes (nested sitemaps)
- Fallback to robots.txt discovery
- CORS-aware error handling

**Usage:**
```javascript
import { SitemapSource } from './sources/index.js';

const source = new SitemapSource();

// Auto-detect sitemap
const pageList = await source.getPageList('https://example.com');

// Use specific sitemap URL
const pageList = await source.getPageList('https://example.com', 'https://example.com/sitemap.xml');
```

**Supported URL Patterns:**
- `https://example.com` (auto-detects sitemap)
- `https://example.com/sitemap.xml`
- `https://example.com/sitemap_index.xml`
- `https://example.com/sitemaps.xml`

**Common Sitemap Locations:**
- `/sitemap.xml`
- `/sitemap_index.xml`
- `/sitemaps.xml`
- `/sitemap/index.xml`

### 2. WordPress Source

**File:** `sources/wordpress.js`

**Purpose:** Uses WordPress REST API to discover pages, posts, and media.

**Best For:**
- WordPress sites with REST API enabled
- WordPress multisite installations
- WordPress.com sites
- Self-hosted WordPress sites

**Features:**
- REST API integration
- Support for posts, pages, and media
- Pagination handling
- Custom post type support
- Direct media library access

**Usage:**
```javascript
import { WordPressSource } from './sources/index.js';

const source = new WordPressSource();

// Get pages and posts
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

**WordPress REST API Endpoints Used:**
- `/wp-json/wp/v2/posts` - Blog posts
- `/wp-json/wp/v2/pages` - Static pages
- `/wp-json/wp/v2/media` - Media library items

**Configuration Options:**
- `postTypes`: Array of content types to scan
- `perPage`: Number of items per API request
- `maxPages`: Maximum number of pages to fetch

### 3. AEM Source

**File:** `sources/eds.js`

**Purpose:** Uses Adobe Experience Manager GraphQL API to discover content and assets.

**Best For:**
- Adobe Experience Manager sites
- Enterprise content management
- Large-scale content repositories
- Multi-site AEM installations

**Features:**
- GraphQL API integration
- Content and asset discovery
- Fallback to sitemap parsing
- DAM (Digital Asset Management) integration
- Multi-language support

**Usage:**
```javascript
import { AEMSource } from './sources/index.js';

const source = new AEMSource();

// Get page list
const pageList = await source.getPageList('https://your-aem-site.com', {
    graphqlEndpoint: '/content/cq:graphql/endpoint.json',
    maxResults: 1000,
    contentPath: '/content'
});

// Get asset list from DAM
const assets = await source.getAssetList('https://your-aem-site.com', {
    damPath: '/content/dam',
    maxResults: 1000
});
```

**AEM GraphQL Endpoints:**
- `/content/cq:graphql/endpoint.json` - Standard GraphQL endpoint
- `/system/graphql` - System GraphQL endpoint
- `/api/graphql` - Custom GraphQL endpoint

**Configuration Options:**
- `graphqlEndpoint`: GraphQL endpoint path
- `maxResults`: Maximum number of results
- `contentPath`: Content path to query
- `damPath`: DAM path for assets

### 4. Adobe Dynamic Assets Source

**File:** `sources/adobe-da.js`

**Purpose:** Uses Adobe Dynamic Media API to discover and manage digital assets.

**Best For:**
- Adobe Dynamic Media customers
- Scene7 implementations
- Digital asset management
- Image and video optimization

**Features:**
- Dynamic Media API integration
- Asset optimization
- Multiple asset type support
- URL generation with parameters
- Metadata extraction

**Usage:**
```javascript
import { AdobeDASource } from './sources/index.js';

const source = new AdobeDASource();

// Get asset list
const pageList = await source.getPageList('https://your-company.scene7.com', {
    apiKey: 'your-api-key',
    companyId: 'your-company-id',
    maxResults: 1000,
    assetTypes: ['image', 'video']
});

// Generate optimized asset URL
const optimizedUrl = source.generateOptimizedUrl(assetUrl, {
    width: 800,
    height: 600,
    quality: 90,
    format: 'jpg'
});
```

**Adobe Dynamic Media URL Patterns:**
- `https://your-company.scene7.com`
- `https://your-company.adobedtm.com`
- Custom Dynamic Media domains

**Configuration Options:**
- `apiKey`: Adobe Dynamic Media API key (required)
- `companyId`: Company identifier (required)
- `maxResults`: Maximum number of assets
- `assetTypes`: Types of assets to fetch

## Data Source Selection Guide

### When to Use Each Source

| Source | Use When | Pros | Cons |
|--------|----------|------|------|
| **Sitemap** | Standard websites, SEO sites | Universal, no API keys needed | Limited to sitemap content |
| **WordPress** | WordPress sites | Rich content discovery, media library access | Requires REST API enabled |
| **AEM** | Enterprise AEM sites | Powerful content management, DAM integration | Complex setup, requires GraphQL |
| **Adobe DA** | Dynamic Media customers | Asset optimization, professional features | Requires API credentials |

### URL Pattern Matching

Each data source automatically detects if it can handle a given URL:

```javascript
import { detectDataSource, getDataSourceRecommendations } from './sources/index.js';

// Auto-detect best source
const sourceName = detectDataSource('https://example.com');
console.log(sourceName); // 'sitemap'

// Get recommendations with scores
const recommendations = getDataSourceRecommendations('https://wordpress-site.com');
console.log(recommendations);
// [
//   { name: 'wordpress', score: 1.0, reason: 'Direct URL match' },
//   { name: 'sitemap', score: 0.5, reason: 'Fallback option' }
// ]
```

## Custom Data Source Development

### Creating a Custom Data Source

To create your own data source, implement the base interface:

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
        const pages = [];
        
        // Your custom logic here
        // Fetch data from your API, database, etc.
        
        return pages.map(item => ({
            url: item.url,
            loc: item.url,
            lastmod: item.lastModified,
            title: item.title,
            type: item.type
        }));
    }
}

// Usage
const customSource = new CustomSource();
const pageList = await customSource.getPageList('https://my-custom-site.com');
```

### Required Methods

#### `canHandle(url)`
- **Purpose:** Determines if the source can handle a given URL
- **Parameters:** `url` (String) - URL to check
- **Returns:** `Boolean` - True if source can handle the URL

#### `getPageList(url, options)`
- **Purpose:** Retrieves page list from the source
- **Parameters:** 
  - `url` (String) - Source URL
  - `options` (Object, optional) - Configuration options
- **Returns:** `Promise<Array<Object>>` - Array of page objects

### Page Object Structure

All data sources should return page objects with this structure:

```javascript
{
    url: string,           // Primary URL (required)
    loc?: string,          // Alternative URL field
    lastmod?: string,      // Last modified date (ISO string)
    title?: string,        // Page title
    type?: string,         // Content type
    priority?: number,     // Priority (0-1)
    changefreq?: string,   // Change frequency
    // Additional custom fields are allowed
}
```

### Error Handling

Implement proper error handling in your custom data source:

```javascript
async getPageList(url, options = {}) {
    try {
        // Your implementation
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return this.parseData(data);
        
    } catch (error) {
        // Provide meaningful error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error(`Network error: Unable to connect to ${url}. Check your internet connection and URL.`);
        } else if (error.message.includes('404')) {
            throw new Error(`Not found: The endpoint ${url} does not exist.`);
        } else {
            throw new Error(`Custom source error: ${error.message}`);
        }
    }
}
```

### Registering Custom Data Sources

To make your custom data source available through the registry:

```javascript
import { dataSources } from './sources/index.js';

// Add your custom source to the registry
dataSources.custom = {
    class: CustomSource,
    name: 'Custom Source',
    description: 'My custom data source',
    supportedTypes: ['custom'],
    defaultOptions: {}
};

// Now it's available through the registry
import { createDataSource } from './sources/index.js';
const customSource = createDataSource('custom');
```

## Best Practices

### 1. Error Handling
- Provide meaningful error messages
- Handle network errors gracefully
- Implement retry logic for transient failures
- Log errors for debugging

### 2. Performance
- Implement pagination for large datasets
- Use appropriate timeouts
- Cache results when possible
- Limit concurrent requests

### 3. Security
- Validate input parameters
- Sanitize URLs and data
- Handle authentication securely
- Respect rate limits

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

#### CORS Errors
**Problem:** Cross-origin requests blocked
**Solutions:**
- Use server-side proxy
- Implement CORS headers
- Use different data source
- Use browser extensions for development

#### Rate Limiting
**Problem:** API requests rate limited
**Solutions:**
- Implement request delays
- Use pagination
- Cache results
- Request higher rate limits

#### Authentication Issues
**Problem:** API authentication failures
**Solutions:**
- Verify API keys
- Check authentication headers
- Implement token refresh
- Use proper authentication flow

#### Large Datasets
**Problem:** Memory or performance issues with large datasets
**Solutions:**
- Implement pagination
- Use streaming processing
- Limit result sets
- Implement incremental loading

### Debug Mode

Enable debug logging for data sources:

```javascript
// Set debug mode
localStorage.setItem('data-source-debug', 'true');

// Your data source will now log detailed information
const pageList = await source.getPageList(url);
```

### Testing Data Sources

Test your data sources with various URLs:

```javascript
// Test URL compatibility
const testUrls = [
    'https://example.com',
    'https://wordpress-site.com',
    'https://aem-site.com',
    'https://scene7-site.com'
];

for (const url of testUrls) {
    const source = detectDataSource(url);
    console.log(`${url} -> ${source}`);
}
```
