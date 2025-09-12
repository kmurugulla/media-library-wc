# Media Library API Reference

Complete API reference for the Media Library component and data sources.

## Media Library Component

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `storage` | String | `'indexeddb'` | Storage backend (`'indexeddb'` or `'local'`) |
| `locale` | String | `'en'` | UI language (`'en'`, `'es'`, `'de'`, `'fr'`) |

### Methods

#### `loadFromPageList(pageList, onProgress, siteKey)`

Loads media data from a list of pages.

**Parameters:**
- `pageList` (Array<Object>): Array of page objects
- `onProgress` (Function, optional): Progress callback
- `siteKey` (String, optional): Storage key

**Page Object Structure:**
```javascript
{
    url: string,           // Page URL
    loc?: string,          // Alternative URL field
    lastmod?: string,      // Last modified date (ISO string)
    title?: string,        // Page title
    type?: string,         // Content type
    priority?: number,     // Priority (0-1)
    changefreq?: string    // Change frequency
}
```

**Progress Callback:**
```javascript
(completed: number, total: number, found: number) => void
```

**Returns:** `Promise<Array<Object>>` - Array of media objects

**Example:**
```javascript
const pageList = [
    { url: 'https://example.com/page1', lastmod: '2024-01-01T00:00:00Z' },
    { url: 'https://example.com/page2', lastmod: '2024-01-02T00:00:00Z' }
];

const mediaData = await mediaLibrary.loadFromPageList(
    pageList,
    (completed, total, found) => {
        console.log(`Progress: ${completed}/${total} pages, ${found} media items`);
    },
    'example-com'
);
```

#### `loadFromStorage(siteKey)`

Loads previously saved media data from storage.

**Parameters:**
- `siteKey` (String): Storage key to load

**Returns:** `Promise<Array<Object>>` - Array of media objects

**Example:**
```javascript
const mediaData = await mediaLibrary.loadFromStorage('example-com');
```

#### `clearData()`

Clears all media data from the component.

**Returns:** `void`

**Example:**
```javascript
mediaLibrary.clearData();
```

#### `generateSiteKey(source)`

Generates a storage key from a source URL.

**Parameters:**
- `source` (String): Source URL or identifier

**Returns:** `String` - Generated site key

**Example:**
```javascript
const siteKey = mediaLibrary.generateSiteKey('https://example.com');
// Returns: 'example_com'
```

### Events

The component dispatches custom events for various actions:

#### `show-notification`

Dispatched when a notification should be shown.

**Event Detail:**
```javascript
{
    heading: string,    // Notification heading
    message: string,    // Notification message
    type: string,       // 'info', 'success', 'error'
    open: boolean       // Whether to show the notification
}
```

**Example:**
```javascript
window.addEventListener('show-notification', (e) => {
    const { heading, message, type } = e.detail;
    showNotification(`${heading}: ${message}`, type);
});
```

#### `open-modal`

Dispatched when a modal should be opened.

**Event Detail:**
```javascript
{
    type: string,       // Modal type ('details', 'settings', etc.)
    data: Object        // Modal data
}
```

## Data Sources

### Base Data Source Interface

All data sources implement this interface:

```javascript
class DataSource {
    constructor() {
        this.name = string;           // Source name
        this.description = string;    // Source description
    }
    
    canHandle(url) {
        // Return true if this source can handle the URL
        return boolean;
    }
    
    async getPageList(url, options) {
        // Return array of page objects
        return Array<Object>;
    }
}
```

### Sitemap Source

#### `SitemapSource`

Discovers and parses XML sitemaps.

**Methods:**

##### `canHandle(url)`

Checks if the source can handle the given URL.

**Parameters:**
- `url` (String): URL to check

**Returns:** `Boolean`

##### `getPageList(source, sitemapUrl)`

Gets page list from sitemap.

**Parameters:**
- `source` (String): Source URL (website or sitemap)
- `sitemapUrl` (String, optional): Specific sitemap URL

**Returns:** `Promise<Array<Object>>` - Array of page objects

**Example:**
```javascript
import { SitemapSource } from './sources/index.js';

const source = new SitemapSource();

// Auto-detect sitemap
const pageList = await source.getPageList('https://example.com');

// Use specific sitemap
const pageList = await source.getPageList('https://example.com', 'https://example.com/sitemap.xml');
```

##### `isWebsiteUrl(url)`

Checks if URL is a website URL (not a sitemap).

**Parameters:**
- `url` (String): URL to check

**Returns:** `Boolean`

##### `autoDetectSitemap(websiteUrl)`

Auto-detects sitemap URL for a website.

**Parameters:**
- `websiteUrl` (String): Website URL

**Returns:** `Promise<String>` - Detected sitemap URL

##### `parseSitemap(sitemapUrl)`

Parses sitemap XML and extracts page list.

**Parameters:**
- `sitemapUrl` (String): Sitemap URL to parse

**Returns:** `Promise<Array<Object>>` - Array of page objects

### WordPress Source

#### `WordPressSource`

Uses WordPress REST API to discover content.

**Methods:**

##### `canHandle(url)`

Checks if the source can handle the given URL.

**Parameters:**
- `url` (String): URL to check

**Returns:** `Boolean`

##### `getPageList(baseUrl, options)`

Gets page list from WordPress REST API.

**Parameters:**
- `baseUrl` (String): WordPress site base URL
- `options` (Object, optional): Configuration options

**Options:**
```javascript
{
    postTypes: Array<string>,    // ['posts', 'pages', 'media']
    perPage: number,             // Items per page (default: 100)
    maxPages: number             // Maximum pages to fetch (default: 10)
}
```

**Returns:** `Promise<Array<Object>>` - Array of page objects

##### `getMediaList(baseUrl, options)`

Gets media items directly from WordPress REST API.

**Parameters:**
- `baseUrl` (String): WordPress site base URL
- `options` (Object, optional): Configuration options

**Options:**
```javascript
{
    perPage: number,             // Items per page (default: 100)
    maxPages: number             // Maximum pages to fetch (default: 10)
}
```

**Returns:** `Promise<Array<Object>>` - Array of media objects

**Example:**
```javascript
import { WordPressSource } from './sources/index.js';

const source = new WordPressSource();

const pageList = await source.getPageList('https://your-wordpress-site.com', {
    postTypes: ['posts', 'pages'],
    perPage: 100,
    maxPages: 10
});

const mediaItems = await source.getMediaList('https://your-wordpress-site.com', {
    perPage: 100,
    maxPages: 10
});
```

### AEM Source

#### `AEMSource`

Uses Adobe Experience Manager GraphQL API.

**Methods:**

##### `canHandle(url)`

Checks if the source can handle the given URL.

**Parameters:**
- `url` (String): URL to check

**Returns:** `Boolean`

##### `getPageList(baseUrl, options)`

Gets page list from AEM GraphQL API.

**Parameters:**
- `baseUrl` (String): AEM site base URL
- `options` (Object, optional): Configuration options

**Options:**
```javascript
{
    graphqlEndpoint: string,     // GraphQL endpoint (default: '/content/cq:graphql/endpoint.json')
    maxResults: number,          // Maximum results (default: 1000)
    contentPath: string          // Content path (default: '/content')
}
```

**Returns:** `Promise<Array<Object>>` - Array of page objects

##### `getAssetList(baseUrl, options)`

Gets asset list from AEM DAM.

**Parameters:**
- `baseUrl` (String): AEM site base URL
- `options` (Object, optional): Configuration options

**Options:**
```javascript
{
    damPath: string,             // DAM path (default: '/content/dam')
    maxResults: number           // Maximum results (default: 1000)
}
```

**Returns:** `Promise<Array<Object>>` - Array of asset objects

**Example:**
```javascript
import { AEMSource } from './sources/index.js';

const source = new AEMSource();

const pageList = await source.getPageList('https://your-aem-site.com', {
    graphqlEndpoint: '/content/cq:graphql/endpoint.json',
    maxResults: 1000,
    contentPath: '/content'
});

const assets = await source.getAssetList('https://your-aem-site.com', {
    damPath: '/content/dam',
    maxResults: 1000
});
```

### Adobe Dynamic Assets Source

#### `AdobeDASource`

Uses Adobe Dynamic Media API.

**Methods:**

##### `canHandle(url)`

Checks if the source can handle the given URL.

**Parameters:**
- `url` (String): URL to check

**Returns:** `Boolean`

##### `getAssetList(baseUrl, options)`

Gets asset list from Adobe Dynamic Media.

**Parameters:**
- `baseUrl` (String): Adobe Dynamic Media base URL
- `options` (Object): Configuration options

**Options:**
```javascript
{
    apiKey: string,              // API key (required)
    companyId: string,           // Company ID (required)
    maxResults: number,          // Maximum results (default: 1000)
    assetTypes: Array<string>    // Asset types (default: ['image', 'video'])
}
```

**Returns:** `Promise<Array<Object>>` - Array of asset objects

##### `getPageList(baseUrl, options)`

Gets page list (converts assets to page format).

**Parameters:**
- `baseUrl` (String): Adobe Dynamic Media base URL
- `options` (Object): Configuration options

**Returns:** `Promise<Array<Object>>` - Array of page objects

##### `getAssetMetadata(assetUrl, options)`

Gets asset metadata.

**Parameters:**
- `assetUrl` (String): Asset URL
- `options` (Object, optional): Configuration options

**Returns:** `Promise<Object>` - Asset metadata

##### `generateOptimizedUrl(assetUrl, params)`

Generates optimized asset URL with parameters.

**Parameters:**
- `assetUrl` (String): Base asset URL
- `params` (Object, optional): Optimization parameters

**Parameters:**
```javascript
{
    width: number,               // Width
    height: number,              // Height
    quality: number,             // Quality (default: 80)
    format: string,              // Format (default: 'auto')
    fit: string                  // Fit mode (default: 'constrain')
}
```

**Returns:** `String` - Optimized asset URL

**Example:**
```javascript
import { AdobeDASource } from './sources/index.js';

const source = new AdobeDASource();

const pageList = await source.getPageList('https://your-company.scene7.com', {
    apiKey: 'your-api-key',
    companyId: 'your-company-id',
    maxResults: 1000,
    assetTypes: ['image', 'video']
});

const optimizedUrl = source.generateOptimizedUrl(assetUrl, {
    width: 800,
    height: 600,
    quality: 90,
    format: 'jpg'
});
```

## Data Source Registry

### `getDataSource(name)`

Gets data source by name.

**Parameters:**
- `name` (String): Data source name

**Returns:** `Object|null` - Data source configuration or null

### `getAllDataSources()`

Gets all available data sources.

**Returns:** `Object` - All data sources

### `getDataSourceNames()`

Gets data source names.

**Returns:** `Array<String>` - Array of data source names

### `createDataSource(name)`

Creates data source instance.

**Parameters:**
- `name` (String): Data source name

**Returns:** `Object|null` - Data source instance or null

### `detectDataSource(url)`

Auto-detects data source for a given URL.

**Parameters:**
- `url` (String): URL to analyze

**Returns:** `String|null` - Data source name or null

### `getDataSourceRecommendations(url)`

Gets data source recommendations for a URL.

**Parameters:**
- `url` (String): URL to analyze

**Returns:** `Array<Object>` - Array of recommended data sources with scores

**Example:**
```javascript
import { 
    getDataSource, 
    getAllDataSources, 
    createDataSource, 
    detectDataSource,
    getDataSourceRecommendations 
} from './sources/index.js';

// Get specific data source
const sitemapConfig = getDataSource('sitemap');

// Get all data sources
const allSources = getAllDataSources();

// Create data source instance
const sitemapSource = createDataSource('sitemap');

// Auto-detect data source
const detectedSource = detectDataSource('https://example.com');

// Get recommendations
const recommendations = getDataSourceRecommendations('https://example.com');
```

## Error Handling

All methods can throw errors. Common error types:

- **Network errors**: CORS, connectivity issues
- **API errors**: Invalid responses, rate limiting
- **Validation errors**: Invalid parameters, unsupported URLs
- **Parse errors**: Malformed XML, JSON, or other data

**Error handling example:**
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
