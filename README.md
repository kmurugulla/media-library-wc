# Media Library Web Component

A browser-based media library web component that scans websites for media files and provides a searchable, filterable interface for managing digital assets.

## Features

- **Browser-Only**: No server dependencies - everything runs in the browser
- **Sitemap Integration**: Automatically scans sitemap.xml files to discover pages
- **Media Detection**: Finds images, videos, documents, and links across your site
- **Smart Filtering**: Filter by media type, alt text status, and usage
- **Dual Views**: Grid and list views with responsive layouts
- **Local Storage**: Uses IndexedDB or localStorage for data persistence
- **Internationalization**: Built-in i18n support with English translations
- **Modern UI**: Clean, responsive design with CSS custom properties
- **Accessibility**: WCAG compliant with keyboard navigation and screen reader support

## Quick Start

### Installation

```bash
npm install media-library
```

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module" src="https://unpkg.com/media-library/dist/media-library.es.js"></script>
</head>
<body>
    <media-library 
        source="https://example.com/sitemap.xml"
        storage="indexeddb"
        locale="en">
    </media-library>
</body>
</html>
```

### CDN Usage

```html
<script type="module" src="https://unpkg.com/media-library/dist/media-library.es.js"></script>
<link rel="stylesheet" href="https://unpkg.com/media-library/dist/style.css">
```

## Examples

The project includes comprehensive examples for each data source type:

### Source-Specific Examples

- **`examples/sitemap/`** - Sitemap source integration
- **`examples/wordpress/`** - WordPress REST API integration  
- **`examples/aem/`** - Adobe Experience Manager (AEM/EDS) integration
- **`examples/adobe-da/`** - Adobe Dynamic Media (DA) integration
- **`examples/multi-source/`** - All sources in a single interface

### Example Structure

Each example folder contains:
- **`index.html`** - Source-specific HTML interface
- **`index.css`** - Styled components and layout
- **`scripts.js`** - Source-specific JavaScript logic

### Running Examples

```bash
# Serve the examples directory
npx serve examples/

# Or use any static file server
python -m http.server 8000
```

### Example URLs

**Sitemap Source:**
```
examples/sitemap/index.html?url=https://example.com&autoscan=true
```

**WordPress Source:**
```
examples/wordpress/index.html?url=https://myblog.com&autoscan=true
```

**AEM/EDS Source:**
```
examples/aem/index.html?org=mycompany&repo=website&autoscan=true
```

**Adobe DA Source:**
```
examples/adobe-da/index.html?org=mycompany&repo=assets&autoscan=true
```

## Configuration

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `source` | String | `''` | URL to sitemap.xml or pages data source |
| `storage` | String | `'indexeddb'` | Storage type: `'indexeddb'`, `'local'` |
| `locale` | String | `'en'` | Language locale (currently supports `'en'`) |

### Query Parameters

The media library supports URL query parameters for deep linking, bookmarking, and automated configuration. This allows you to pre-configure the component and optionally trigger automatic scanning.

#### Supported Parameters

| Parameter | Description | Example Values |
|-----------|-------------|----------------|
| `source` | Data source type | `sitemap`, `wordpress`, `aem`, `adobe-da` |
| `url` | Website URL | `https://example.com` |
| `sitemap` | Direct sitemap URL | `https://example.com/sitemap.xml` |
| `org` | Organization (AEM/Adobe DA) | `mycompany` |
| `repo` | Repository (AEM/Adobe DA) | `website` |
| `storage` | Storage type | `indexeddb`, `local` |
| `locale` | Language locale | `en`, `es`, `de`, `fr` |
| `load` | Load existing site from storage | `site-key-name` |
| `autoscan` | Auto-start scanning | `true`, `false` |

#### Example URLs

**Sitemap with Auto-Scan:**
```
index.html?source=sitemap&url=https://example.com&autoscan=true
```

**WordPress with Custom Settings:**
```
index.html?source=wordpress&url=https://myblog.com&storage=local&locale=es&autoscan=true
```

**AEM/EDS Configuration:**
```
index.html?source=aem&org=mycompany&repo=website&autoscan=true
```

**Adobe DA Configuration:**
```
index.html?source=adobe-da&org=mycompany&repo=assets&autoscan=true
```

**Load Existing Site:**
```
index.html?load=example-com&storage=indexeddb
```

**Direct Sitemap URL:**
```
index.html?source=sitemap&sitemap=https://example.com/sitemap.xml&autoscan=true
```

#### Use Cases

- **Bookmarking**: Save frequently used configurations as bookmarks
- **Sharing**: Share pre-configured URLs with team members
- **Automation**: Trigger scans from external systems or dashboards
- **Deep Linking**: Direct access to specific site configurations
- **Embedding**: Use in iframes with pre-configured settings

### Storage Options

- **`indexeddb`** (default): Uses browser's IndexedDB for large datasets
- **`local`**: Uses localStorage for smaller datasets

## API

### Component Events

The component dispatches custom events for integration:

```javascript
const mediaLibrary = document.querySelector('media-library');

// Search events
mediaLibrary.addEventListener('search', (e) => {
    console.log('Search query:', e.detail.query);
});

// View change events
mediaLibrary.addEventListener('viewChange', (e) => {
    console.log('View changed to:', e.detail.view);
});

// Filter events
mediaLibrary.addEventListener('filter', (e) => {
    console.log('Filter changed to:', e.detail.type);
});

// Scan events
mediaLibrary.addEventListener('scan', (e) => {
    console.log('Scan started');
});
```

### JavaScript API

```javascript
import { BrowserStorage, SitemapParser } from 'media-library';

// Direct storage access
const storage = new BrowserStorage('indexeddb');
await storage.save(mediaData);
const data = await storage.load();

// Direct sitemap parsing
const parser = new SitemapParser();
const urls = await parser.parseSitemap('https://example.com/sitemap.xml');
const mediaData = await parser.scanPages(urls);
```

## Data Format

The component works with media data in this format:

```javascript
[
  {
    "url": "https://example.com/images/hero.jpg",
    "name": "hero.jpg",
    "alt": "Hero image description",
    "type": "img > jpg",
    "doc": "/index.html",
    "ctx": "img > In div: hero-section > text: Welcome to our site",
    "hash": "abc123def456",
    "firstUsedAt": 1703123456789,
    "lastUsedAt": 1703123456789
  }
]
```

## Filtering

### Available Filters

- **All Media**: Shows all media files (excluding SVGs)
- **Images**: JPG, PNG, GIF, WebP, AVIF files
- **Videos**: MP4, WebM, MOV, AVI files
- **Documents**: PDF files
- **Links**: Media files linked via `<a>` tags
- **SVGs**: SVG files and icons
- **Missing Alt Text**: Images without alt attributes
- **Unused**: Media files not referenced in any page

### Search Syntax

- **Basic search**: `hero image` - searches across all fields
- **Field-specific**: `doc:about` - searches in document paths
- **Folder search**: `/images/` - searches in specific folders

## Customization

### CSS Custom Properties

Override the default theme:

```css
media-library {
    --ml-primary: #your-brand-color;
    --ml-surface: #your-background-color;
    --ml-text: #your-text-color;
    --ml-border: #your-border-color;
}
```

### Styling

The component uses CSS custom properties for theming. All colors, spacing, and other design tokens can be customized:

```css
:root {
    --ml-primary: #3b82f6;
    --ml-primary-hover: #2563eb;
    --ml-surface: #ffffff;
    --ml-surface-elevated: #f8fafc;
    --ml-border: #e2e8f0;
    --ml-text: #1e293b;
    --ml-text-muted: #64748b;
    --ml-space-xs: 0.25rem;
    --ml-space-sm: 0.5rem;
    --ml-space-md: 1rem;
    --ml-space-lg: 1.5rem;
    --ml-radius-sm: 0.25rem;
    --ml-radius-md: 0.375rem;
    --ml-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --ml-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Development

### Setup

```bash
git clone https://github.com/your-org/media-library.git
cd media-library
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm run test
```

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Performance

- **Responsive Grid**: Handles thousands of media items with CSS Grid layout
- **Lazy Loading**: Images load only when visible
- **Throttled Scanning**: Prevents browser overload during site scanning
- **IndexedDB**: Optimized for large datasets

## Security

- **CORS Compliant**: Respects browser security policies
- **No External Dependencies**: All processing happens in the browser
- **Local Storage**: Data never leaves the user's device

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [GitHub Wiki](https://github.com/your-org/media-library/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/media-library/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/media-library/discussions)

## Changelog

### v1.1.0
- **Query Parameter Support**: Added comprehensive URL parameter support for deep linking and bookmarking
- **Auto-Scan Feature**: Added `autoscan` parameter for automatic scanning on page load
- **Multi-Source Configuration**: Support for sitemap, WordPress, AEM/EDS, and Adobe DA sources via URL parameters
- **Form Auto-Population**: Automatic form filling from URL parameters
- **Enhanced User Experience**: Improved workflow for sharing and bookmarking configurations

### v1.0.0
- Initial release
- Sitemap parsing
- Media scanning and detection
- Grid and list views
- Filtering and search
- IndexedDB and localStorage support
- Internationalization
- Accessibility features
