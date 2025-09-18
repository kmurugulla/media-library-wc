# Media Library Web Component

A browser-based media library web component that scans websites for media files and provides a searchable, filterable interface for managing digital assets.

## Features

| Feature | Description |
|---------|-------------|
| **Browser-Only** | No server dependencies - everything runs in the browser |
| **Real-Time Scanning** | Live progress updates with media preview during scan |
| **Smart Categorization** | Automatic categorization (People, Graphics & UI, Logos, Products) |
| **Advanced Filtering** | Filter by categories, media types, and accessibility status |
| **Dual Views** | Grid and list views with responsive layouts |
| **Local Storage** | Uses IndexedDB or localStorage for data persistence |
| **Multi-Source Support** | Sitemap, WordPress, AEM, Adobe DA integration |
| **Accessibility** | WCAG compliant with keyboard navigation and screen reader support |

## For Users

### Scanning Process

**During Scan:**
- **Live Media Preview**: Media items appear in real-time as they're discovered
- **Progress Stats**: Shows pages scanned, media found, and elapsed time
- **Visual Cards**: Each media item displays as a preview card with thumbnail and filename

**After Scan Complete:**
- **Full Featured Library**: Complete media library with search, filtering, and categorization
- **Advanced Filters**: Filter by categories (People, Graphics & UI, Logos, Products), media types, and accessibility
- **Detailed Views**: Click any media item to see usage details, context, and metadata

## For Developers

### Step 1: Copy Distribution Files

Copy the contents of the `dist/` folder to your project:

```
dist/
├── media-library.es.js          # Main component
├── style.css                    # Styles
├── icons/                       # SVG icons
├── locales/                     # Translation files
└── category-patterns.json       # Categorization rules
```

### Step 2: Use Web Component

Add the component to your HTML:

```html
<script type="module" src="./dist/media-library.es.js"></script>
<link rel="stylesheet" href="./dist/style.css">

<media-library 
    source="sitemap"
    url="https://example.com"
    storage="indexeddb"
    locale="en">
</media-library>
```

### Step 3: Reference Examples for Data Sources

| Source Type | Example File | Key Lines for Data Passing |
|-------------|--------------|---------------------------|
| **Sitemap** | `examples/sitemap/scripts.js` | Line 109: `loadFromPageList(pageList, ...)` |
| **WordPress** | `examples/wordpress/scripts.js` | Line 111: `loadFromPageList(pageList, ...)` |
| **AEM/EDS** | `examples/aem/scripts.js` | Line 81: `loadFromPageList(pageList, ...)` |
| **Adobe DA** | `examples/adobe-da/scripts.js` | Line 129: `loadFromPageList(pageList, ...)` |
| **Direct Media** | `examples/mediabus-audit/scripts.js` | Line 64: `loadMediaData(mediaData, ...)` |

### Configuration Options

| Parameter | Values | Description |
|-----------|--------|-------------|
| `source` | `sitemap`, `wordpress`, `aem`, `adobe-da` | Data source type |
| `url` | Website URL | Target website to scan |
| `storage` | `indexeddb`, `local` | Storage backend |
| `locale` | `en`, `es`, `de`, `fr` | Language locale |
| `autoscan` | `true`, `false` | Auto-start scanning |

### Running Examples

```bash
# Serve the examples directory
npx serve examples/
```

**Quick Test URLs:**
- Sitemap: `examples/sitemap/index.html?url=https://example.com&autoscan=true`
- WordPress: `examples/wordpress/index.html?url=https://myblog.com&autoscan=true`
- AEM: `examples/aem/index.html?org=mycompany&repo=website&autoscan=true`

### Query Parameters

The component supports URL parameters for deep linking and automation:

```
index.html?source=sitemap&url=https://example.com&autoscan=true
index.html?source=wordpress&url=https://myblog.com&storage=local&autoscan=true
index.html?source=aem&org=mycompany&repo=website&autoscan=true
```

## Development

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-org/media-library.git
cd media-library

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

