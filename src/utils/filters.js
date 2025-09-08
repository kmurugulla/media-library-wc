// src/utils/filters.js
import { getAvailableCategories } from './category-detector.js';

export const FILTER_CONFIG = {
  images: (item) => getMediaType(item) === 'image' && !isSvgFile(item),
  videos: (item) => getMediaType(item) === 'video',
  documents: (item) => getMediaType(item) === 'document',
  links: (item) => getMediaType(item) === 'link',
  icons: (item) => isSvgFile(item),

  missingAlt: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt === 'null',
  decorative: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt === '',
  filled: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt && item.alt !== '' && item.alt !== 'null',
  unused: (item) => !item.doc || item.doc.trim() === '',

  // Orientation filters (only for images with analysis data)
  landscape: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.orientation === 'landscape',
  portrait: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.orientation === 'portrait',
  square: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.orientation === 'square',

  // Performance filters (based on performance tags in context)
  lcpCandidate: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'lcp-candidate'),
  aboveFold: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'above-fold'),
  belowFold: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'below-fold'),
  needsOptimization: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'needs-optimization'),
  fullyOptimized: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'fully-optimized'),
  noSrcset: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'no-srcset'),
  hasSrcset: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'has-srcset'),
  legacyFormat: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'legacy-format'),
  modernFormat: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'modern-format'),
  noLazyLoading: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'no-loading-strategy'),
  lazyLoading: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'lazy-loading'),
  socialImage: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'social-image'),
  ogImage: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'og-image'),
  performanceIssue: (item) => getMediaType(item) === 'image' && !isSvgFile(item) && hasPerformanceTag(item, 'performance-issue'),

  // Category-based filters
  'hero-images': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'hero-images',
  'team-people': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'team-people',
  'navigation': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'navigation',
  'articles': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'articles',
  'products': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'products',
  'decorative': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'decorative',
  'social-media': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'social-media',
  'documents': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'documents',
  'logos': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'logos',
  'screenshots': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === 'screenshots',
  '404s': (item) => getMediaType(item) === 'image' && !isSvgFile(item) && item.category === '404s',

  documentImages: (item, selectedDocument) => FILTER_CONFIG.images(item) && item.doc === selectedDocument,
  documentIcons: (item, selectedDocument) => FILTER_CONFIG.icons(item) && item.doc === selectedDocument,
  documentVideos: (item, selectedDocument) => FILTER_CONFIG.videos(item) && item.doc === selectedDocument,
  documentDocuments: (item, selectedDocument) => FILTER_CONFIG.documents(item) && item.doc === selectedDocument,
  documentLinks: (item, selectedDocument) => FILTER_CONFIG.links(item) && item.doc === selectedDocument,
  documentMissingAlt: (item, selectedDocument) => item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt === 'null' && item.doc === selectedDocument,
  documentDecorative: (item, selectedDocument) => item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt === '' && item.doc === selectedDocument,
  documentFilled: (item, selectedDocument) => item.doc === selectedDocument && item.type?.startsWith('img >') && !item.type?.includes('svg') && item.alt && item.alt !== '' && item.alt !== 'null',

  documentTotal: () => true,
  all: (item) => !isSvgFile(item),
};

export function applyFilter(data, filterName, selectedDocument) {
  const filterFn = FILTER_CONFIG[filterName];

  if (filterFn) {
    if (filterName.startsWith('document')) {
      return data.filter((item) => filterFn(item, selectedDocument));
    }
    return data.filter(filterFn);
  }

  return data;
}

export function getAvailableFilters() {
  return Object.keys(FILTER_CONFIG);
}

/**
 * Get category-based filters only
 * @returns {Array} Array of category filter names
 */
export function getCategoryFilters() {
  const categories = getAvailableCategories();
  return categories.filter(category => category !== 'other');
}

/**
 * Parse colon syntax from search query (e.g., "doc:path", "name:value")
 */
export function parseColonSyntax(query) {
  if (!query) return null;

  const colonMatch = query.match(/^([a-zA-Z]+):(.*)$/);
  if (colonMatch) {
    const [, field, value] = colonMatch;
    return {
      field: field.toLowerCase(),
      value: value.trim().toLowerCase(),
      originalQuery: query,
    };
  }

  if (query.startsWith('/') || query.includes('/')) {
    return {
      field: 'folder',
      value: query.toLowerCase().trim(),
      originalQuery: query,
    };
  }

  return null;
}

function filterByColonSyntax(mediaData, colonSyntax) {
  const { field, value } = colonSyntax;

  const filteredResults = mediaData.filter((item) => {
    switch (field) {
      case 'doc':
        return item.doc && item.doc.toLowerCase().includes(value);
      case 'name':
        return item.name && item.name.toLowerCase().includes(value);
      case 'alt':
        return item.alt && item.alt.toLowerCase().includes(value);
      case 'url':
        return item.url && item.url.toLowerCase().includes(value);
      case 'folder': {
        if (!item.doc) return false;

        if (value === '' || value === '/') {
          return !item.doc.includes('/', 1);
        }

        const cleanPath = item.doc.replace(/\.html$/, '');
        const parts = cleanPath.split('/');
        const folderPath = parts.slice(0, -1).join('/');
        return folderPath.toLowerCase().includes(value);
      }
      case 'perf': {
        // Performance tag filtering
        if (!item.ctx) return false;
        
        // Look for perf: section in context
        const perfMatch = item.ctx.match(/perf:([^>]+)/);
        if (!perfMatch) return false;
        
        const perfTags = perfMatch[1].split(',').map(tag => tag.trim().toLowerCase());
        const searchValue = value.toLowerCase();
        
        // Support exact tag matching and partial matching
        return perfTags.some(tag => 
          tag === searchValue || 
          tag.includes(searchValue) ||
          searchValue.includes(tag)
        );
      }
      default:
        return false;
    }
  });

  return filteredResults;
}

function filterBySearchQuery(mediaData, query) {
  if (!query || query.trim() === '') {
    return mediaData;
  }

  const lowerQuery = query.toLowerCase().trim();

  return mediaData.filter((item) => {
    // Search in name
    if (item.name && item.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in alt text
    if (item.alt && item.alt.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in document path
    if (item.doc && item.doc.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in context
    if (item.ctx && item.ctx.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in URL
    if (item.url && item.url.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}

export function calculateFilteredMediaData(mediaData, selectedFilterType, searchQuery, selectedDocument) {
  if (!mediaData || mediaData.length === 0) {
    return [];
  }

  let filteredData = [...mediaData];

  // Apply search query first
  if (searchQuery && searchQuery.trim()) {
    const colonSyntax = parseColonSyntax(searchQuery);
    if (colonSyntax) {
      filteredData = filterByColonSyntax(filteredData, colonSyntax);
    } else {
      filteredData = filterBySearchQuery(filteredData, searchQuery);
    }
  }

  // Apply filter type
  if (selectedFilterType && selectedFilterType !== 'all') {
    filteredData = applyFilter(filteredData, selectedFilterType, selectedDocument);
  }

  return filteredData;
}

export function processMediaData(mediaData) {
  if (!mediaData || mediaData.length === 0) {
    return {
      filterCounts: {},
      totalCount: 0
    };
  }

  const filterCounts = {};

  // First, get unique media URLs to count unique items, not instances
  const uniqueMediaUrls = new Set();
  mediaData.forEach(item => {
    if (item.url) {
      uniqueMediaUrls.add(item.url);
    }
  });

  // Calculate counts for each filter using unique media URLs
  Object.keys(FILTER_CONFIG).forEach(filterName => {
    if (filterName.startsWith('document')) {
      // Skip document-specific filters for general counts
      return;
    }
    
    // Count unique media URLs that match the filter
    const matchingUrls = new Set();
    mediaData.forEach(item => {
      try {
        if (FILTER_CONFIG[filterName](item) && item.url) {
          matchingUrls.add(item.url);
        }
      } catch {
        // Skip items that cause errors
      }
    });
    
    filterCounts[filterName] = matchingUrls.size;
  });

  // Calculate total count (excluding SVGs for "all" filter) - count unique URLs
  const uniqueNonSvgUrls = new Set();
  mediaData.forEach(item => {
    if (item.url && !isSvgFile(item)) {
      uniqueNonSvgUrls.add(item.url);
    }
  });
  filterCounts.all = uniqueNonSvgUrls.size;

  return {
    filterCounts,
    totalCount: uniqueMediaUrls.size
  };
}

// Helper functions
function getMediaType(media) {
  const type = media.type || '';
  if (type.startsWith('img >')) return 'image';
  if (type.startsWith('video >')) return 'video';
  if (type.startsWith('document >')) return 'document';
  if (type.startsWith('link >')) return 'link';

  const mediaUrl = media.url || '';
  const ext = extractFileExtension(mediaUrl);
  return detectMediaTypeFromExtension(ext);
}

function isSvgFile(media) {
  const type = media.type || '';
  return type === 'img > svg' || type === 'link > svg';
}

function extractFileExtension(filePath) {
  return filePath?.split('.').pop()?.toLowerCase();
}

function detectMediaTypeFromExtension(ext) {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi'];
  const documentExtensions = ['pdf'];
  const audioExtensions = ['mp3', 'wav'];
  
  if (imageExtensions.includes(ext)) return 'image';
  if (videoExtensions.includes(ext)) return 'video';
  if (documentExtensions.includes(ext)) return 'document';
  if (audioExtensions.includes(ext)) return 'audio';
  return 'unknown';
}

/**
 * Check if a media item has a specific performance tag
 * @param {Object} item - Media item
 * @param {string} tag - Performance tag to check for
 * @returns {boolean} Whether the item has the performance tag
 */
function hasPerformanceTag(item, tag) {
  if (!item.ctx) return false;
  
  // Look for perf: section in context
  const perfMatch = item.ctx.match(/perf:([^>]+)/);
  if (!perfMatch) return false;
  
  const perfTags = perfMatch[1].split(',').map(t => t.trim().toLowerCase());
  return perfTags.includes(tag.toLowerCase());
}
