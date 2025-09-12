# Data Source Reference Implementations

This directory contains reference implementations of data sources for the Media Library component. These are **example implementations** that demonstrate how to create custom data sources for different content management systems and APIs.

## Data Source Interface

All data sources must implement the following interface:

### Required Methods

#### `canHandle(url)`
- **Purpose**: Determines if this data source can handle the given URL
- **Parameters**: `url` (string) - The URL to check
- **Returns**: `boolean` - True if this source can handle the URL

#### `getPageList(source, options)`
- **Purpose**: Retrieves a list of pages/assets from the source
- **Parameters**: 
  - `source` (string) - The source URL or identifier
  - `options` (object, optional) - Configuration options specific to the data source
- **Returns**: `Promise<Array>` - Array of page objects with the following structure:
  ```javascript
  {
    url: string,        // Full URL to the page/asset
    loc: string,        // Location (usually same as url)
    lastmod: string,    // Last modified date (ISO string)
    title?: string,     // Optional title
    type?: string,      // Optional type identifier
    // ... additional properties specific to the source
  }
  ```

### Optional Methods

#### `getMediaList(source, options)`
- **Purpose**: Retrieves media assets directly (if supported)
- **Parameters**: Same as `getPageList`
- **Returns**: `Promise<Array>` - Array of media objects

## Reference Implementations

### 1. SitemapSource (`sitemap.js`)
- **Purpose**: Discovers pages via XML sitemaps
- **Use Case**: Works with any website that has a sitemap
- **Features**: Auto-detection, robots.txt parsing, fallback page lists

### 2. WordPressSource (`wordpress.js`)
- **Purpose**: Discovers content via WordPress REST API
- **Use Case**: WordPress sites with REST API enabled
- **Features**: Posts, pages, media discovery

### 3. AEMSource (`eds.js`)
- **Purpose**: Discovers content via Adobe Experience Manager GraphQL API
- **Use Case**: AEM sites with GraphQL endpoints
- **Features**: Page and asset discovery, fallback to sitemap

### 4. AdobeDASource (`adobe-da.js`)
- **Purpose**: Discovers assets via Adobe Dynamic Media API
- **Use Case**: Adobe Dynamic Media/Scene7 implementations
- **Features**: Asset discovery, optimized URL generation

## Usage Example

```javascript
import { SitemapSource } from './sources/sitemap.js';

const source = new SitemapSource();

// Check if source can handle a URL
if (source.canHandle('https://example.com')) {
  // Get page list
  const pages = await source.getPageList('https://example.com');
  console.log('Found pages:', pages);
}
```

## Creating Custom Data Sources

To create a custom data source:

1. Create a new class that implements the required interface
2. Add URL pattern detection in `canHandle()`
3. Implement `getPageList()` to fetch and return page data
4. Optionally implement `getMediaList()` for direct media access
5. Export the class as default

### Example Custom Source

```javascript
class CustomSource {
  constructor() {
    this.name = 'Custom Source';
    this.description = 'Custom data source implementation';
  }

  canHandle(url) {
    return url.includes('custom-cms.com');
  }

  async getPageList(source, options = {}) {
    // Your custom implementation
    const response = await fetch(`${source}/api/pages`);
    const data = await response.json();
    
    return data.pages.map(page => ({
      url: page.url,
      loc: page.url,
      lastmod: page.updated_at,
      title: page.title
    }));
  }
}

export default CustomSource;
```

## Integration with Media Library

The Media Library component expects data sources to provide page lists that it can then parse for media content. The component handles:

- Parsing HTML content from page URLs
- Extracting media elements (images, videos, etc.)
- Categorizing and filtering media
- Storage and caching

Your data source only needs to provide the list of pages to scan.
