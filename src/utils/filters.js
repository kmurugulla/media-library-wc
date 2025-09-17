import { getAvailableCategories } from './category-detector.js';

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

function hasPerformanceTag(item, tag) {
  if (!item.ctx) return false;

  const perfMatch = item.ctx.match(/perf:([^>]+)/);
  if (!perfMatch) return false;

  const perfTags = perfMatch[1].split(',').map((t) => t.trim().toLowerCase());
  return perfTags.includes(tag.toLowerCase());
}

export const FILTER_CONFIG = {
  images: (item) => getMediaType(item) === 'image' && !isSvgFile(item),
  videos: (item) => getMediaType(item) === 'video',
  documents: (item) => getMediaType(item) === 'document',
  links: (item) => getMediaType(item) === 'link',
  icons: (item) => isSvgFile(item),

  missingAlt: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg')
    && item.alt === 'null',
  decorative: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg')
    && item.alt === '',
  filled: (item) => item.type?.startsWith('img >') && !item.type?.includes('svg')
    && item.alt && item.alt !== '' && item.alt !== 'null',
  unused: (item) => !item.doc || item.doc.trim() === '',

  landscape: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.orientation === 'landscape',
  portrait: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.orientation === 'portrait',
  square: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.orientation === 'square',
  lcpCandidate: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'lcp-candidate'),
  aboveFold: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'above-fold'),
  belowFold: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'below-fold'),
  needsOptimization: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'needs-optimization'),
  fullyOptimized: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'fully-optimized'),
  noSrcset: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'no-srcset'),
  hasSrcset: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'has-srcset'),
  legacyFormat: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'legacy-format'),
  modernFormat: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'modern-format'),
  noLazyLoading: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'no-loading-strategy'),
  lazyLoading: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'lazy-loading'),
  socialImage: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'social-image'),
  ogImage: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'og-image'),
  performanceIssue: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && hasPerformanceTag(item, 'performance-issue'),

  screenshots: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.category === 'screenshots',
  logos: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.category === 'logos',
  'people-photos': (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.category === 'people-photos',
  products: (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.category === 'products',
  '404-media': (item) => getMediaType(item) === 'image' && !isSvgFile(item)
    && item.category === '404-media',

  documentImages: (item, selectedDocument) => FILTER_CONFIG.images(item)
    && item.doc === selectedDocument,
  documentIcons: (item, selectedDocument) => FILTER_CONFIG.icons(item)
    && item.doc === selectedDocument,
  documentVideos: (item, selectedDocument) => FILTER_CONFIG.videos(item)
    && item.doc === selectedDocument,
  documentDocuments: (item, selectedDocument) => FILTER_CONFIG.documents(item)
    && item.doc === selectedDocument,
  documentLinks: (item, selectedDocument) => FILTER_CONFIG.links(item)
    && item.doc === selectedDocument,
  documentMissingAlt: (item, selectedDocument) => item.type?.startsWith('img >')
    && !item.type?.includes('svg') && item.alt === 'null' && item.doc === selectedDocument,
  documentDecorative: (item, selectedDocument) => item.type?.startsWith('img >')
    && !item.type?.includes('svg') && item.alt === '' && item.doc === selectedDocument,
  documentFilled: (item, selectedDocument) => item.doc === selectedDocument
    && item.type?.startsWith('img >') && !item.type?.includes('svg')
    && item.alt && item.alt !== '' && item.alt !== 'null',

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

export function getCategoryFilters() {
  const categories = getAvailableCategories();
  return categories.filter((category) => category !== 'other');
}

export function parseColonSyntax(query) {
  if (!query) return null;

  const colonMatch = query.match(/^([a-zA-Z]+):(.*)$/);
  if (colonMatch) {
    const [, field, value] = colonMatch;
    const result = {
      field: field.toLowerCase(),
      value: value.trim().toLowerCase(),
      originalQuery: query,
    };
    return result;
  }

  if (query.startsWith('/') || query.includes('/')) {
    const result = {
      field: 'folder',
      value: query.toLowerCase().trim(),
      originalQuery: query,
    };
    return result;
  }

  return null;
}

function filterByColonSyntax(mediaData, colonSyntax) {
  const { field, value } = colonSyntax;

  const filteredResults = mediaData.filter((item) => {
    switch (field) {
      case 'doc': {
        if (!item.doc) return false;

        let docPath = item.doc;
        try {
          const url = new URL(item.doc);
          docPath = url.pathname;
        } catch {
          docPath = item.doc;
        }

        const docMatch = docPath.toLowerCase().includes(value)
                        || item.doc.toLowerCase().includes(value);
        return docMatch;
      }
      case 'name': {
        const nameMatch = item.name && item.name.toLowerCase().includes(value);
        return nameMatch;
      }
      case 'alt': {
        const altMatch = item.alt && item.alt.toLowerCase().includes(value);
        return altMatch;
      }
      case 'url': {
        const urlMatch = item.url && item.url.toLowerCase().includes(value);
        return urlMatch;
      }
      case 'folder': {
        if (!item.doc) return false;

        let docPath = item.doc;
        try {
          const url = new URL(item.doc);
          docPath = url.pathname;
        } catch {
          docPath = item.doc;
        }

        if (value === '' || value === '/') {
          return !docPath.includes('/', 1);
        }

        const cleanPath = docPath.replace(/\.html$/, '');
        const parts = cleanPath.split('/');

        if (parts.length > 2) {
          const folderPath = parts.slice(0, -1).join('/');
          const searchPath = value.startsWith('/') ? value : `/${value}`;
          const folderMatch = folderPath === searchPath;
          return folderMatch;
        }

        return false;
      }
      case 'perf': {
        if (!item.ctx) return false;

        const perfMatch = item.ctx.match(/perf:([^>]+)/);
        if (!perfMatch) return false;

        const perfTags = perfMatch[1].split(',').map((tag) => tag.trim().toLowerCase());
        const searchValue = value.toLowerCase();
        return perfTags.some((tag) => tag === searchValue
          || tag.includes(searchValue)
          || searchValue.includes(tag));
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
    if (item.name && item.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (item.alt && item.alt.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (item.doc && item.doc.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (item.ctx && item.ctx.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (item.url && item.url.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}

export function calculateFilteredMediaData(
  mediaData,
  selectedFilterType,
  searchQuery,
  selectedDocument,
) {
  if (!mediaData || mediaData.length === 0) {
    return [];
  }

  let filteredData = [...mediaData];

  if (searchQuery && searchQuery.trim()) {
    const colonSyntax = parseColonSyntax(searchQuery);
    if (colonSyntax) {
      filteredData = filterByColonSyntax(filteredData, colonSyntax);
    } else {
      filteredData = filterBySearchQuery(filteredData, searchQuery);
    }
  }

  if (selectedFilterType && selectedFilterType !== 'all') {
    filteredData = applyFilter(filteredData, selectedFilterType, selectedDocument);
  }

  return filteredData;
}

function generateFolderSuggestions(mediaData, value) {
  const folderPaths = new Set();

  mediaData.forEach((item) => {
    if (item.doc) {
      let docPath = item.doc;
      try {
        const url = new URL(item.doc);
        docPath = url.pathname;
      } catch {
        docPath = item.doc;
      }

      const cleanPath = docPath.replace(/\.html$/, '');
      const parts = cleanPath.split('/');

      if (parts.length > 2) {
        for (let i = 1; i < parts.length - 1; i += 1) {
          const folderPath = parts.slice(0, i + 1).join('/');
          folderPaths.add(folderPath);
        }
      } else if (parts.length === 2) {
        folderPaths.add('/');
      }
    }
  });

  const filteredPaths = Array.from(folderPaths).filter((folderPath) => {
    if (value === '' || value === '/') {
      return true;
    }
    const searchPath = value.startsWith('/') ? value : `/${value}`;
    return folderPath.startsWith(searchPath);
  });

  const folderSuggestions = filteredPaths.map((folderPath) => ({
    type: 'folder',
    value: folderPath,
    display: folderPath,
  }));

  return folderSuggestions.slice(0, 10);
}

export function createSearchSuggestion(item) {
  if (!item.name && !item.url && !item.doc) return null;

  if (isSvgFile(item)) return null;

  return {
    type: 'media',
    value: item,
    display: item.name || item.url || 'Unnamed Media',
    details: {
      alt: item.alt,
      doc: item.doc,
      url: item.url,
      type: getMediaType(item),
    },
  };
}

export function generateSearchSuggestions(mediaData, query, createSuggestionFn, maxResults = 10) {
  if (!query || !query.trim() || !mediaData) {
    return [];
  }

  const suggestions = [];
  const matchingDocs = new Set();
  let processedCount = 0;
  const maxProcessItems = 1000;

  const colonSyntax = parseColonSyntax(query);

  if (colonSyntax) {
    const { field, value } = colonSyntax;

    if (field === 'folder') {
      return generateFolderSuggestions(mediaData, value);
    }

    for (const item of mediaData) {
      if (processedCount >= maxProcessItems) break;
      processedCount += 1;

      switch (field) {
        case 'doc': {
          if (item.doc && item.doc.toLowerCase().includes(value)) {
            matchingDocs.add(item.doc);
          }
          break;
        }
        case 'alt': {
          if (item.alt && item.alt.toLowerCase().includes(value) && !isSvgFile(item)) {
            suggestions.push(createSuggestionFn(item));
            if (suggestions.length >= maxResults) break;
          }
          break;
        }
        case 'name': {
          if (item.name && item.name.toLowerCase().includes(value) && !isSvgFile(item)) {
            suggestions.push(createSuggestionFn(item));
            if (suggestions.length >= maxResults) break;
          }
          break;
        }
        case 'url': {
          if (item.url && item.url.toLowerCase().includes(value) && !isSvgFile(item)) {
            suggestions.push(createSuggestionFn(item));
            if (suggestions.length >= maxResults) break;
          }
          break;
        }
        default:
          break;
      }
    }

    const docSuggestions = Array.from(matchingDocs).map((doc) => ({
      type: 'doc',
      value: doc,
      display: doc,
    }));

    return [...docSuggestions, ...suggestions].slice(0, maxResults);
  }

  const q = query.toLowerCase().trim();

  if (q === '/') {
    for (const item of mediaData) {
      if (suggestions.length >= maxResults) break;
      if (item.doc && !item.doc.includes('/', 1)) {
        suggestions.push(createSuggestionFn(item));
      }
    }
    return suggestions.slice(0, maxResults);
  }

  for (const item of mediaData) {
    if (processedCount >= maxProcessItems) break;
    processedCount += 1;

    if (item.doc && item.doc.toLowerCase().includes(q)) {
      matchingDocs.add(item.doc);
    }

    if (!isSvgFile(item) && (
      (item.name && item.name.toLowerCase().includes(q))
        || (item.alt && item.alt.toLowerCase().includes(q))
        || (item.url && item.url.toLowerCase().includes(q))
    )) {
      suggestions.push(createSuggestionFn(item));
      if (suggestions.length >= maxResults) break;
    }
  }

  const docSuggestions = Array.from(matchingDocs).map((doc) => ({
    type: 'doc',
    value: doc,
    display: doc,
  }));

  return [...docSuggestions, ...suggestions].slice(0, maxResults);
}

let processedDataCache = null;
let lastProcessedDataHash = null;

function createDataHash(mediaData) {
  if (!mediaData || mediaData.length === 0) return '';

  const { length } = mediaData;
  const firstItem = mediaData[0];
  const lastItem = mediaData[length - 1];

  return `${length}-${firstItem?.url || ''}-${lastItem?.url || ''}`;
}

export function processMediaData(mediaData) {
  if (!mediaData || mediaData.length === 0) {
    processedDataCache = {
      filterCounts: {},
      totalCount: 0,
    };
    return processedDataCache;
  }

  const currentHash = createDataHash(mediaData);
  if (processedDataCache && lastProcessedDataHash === currentHash) {
    return processedDataCache;
  }

  const filterCounts = {};
  const uniqueMediaUrls = new Set();
  const uniqueNonSvgUrls = new Set();

  const filterUrlSets = {};
  Object.keys(FILTER_CONFIG).forEach((filterName) => {
    if (!filterName.startsWith('document')) {
      filterUrlSets[filterName] = new Set();
    }
  });

  mediaData.forEach((item) => {
    if (item.url) {
      uniqueMediaUrls.add(item.url);

      if (!isSvgFile(item)) {
        uniqueNonSvgUrls.add(item.url);
      }

      Object.keys(filterUrlSets).forEach((filterName) => {
        try {
          if (FILTER_CONFIG[filterName](item)) {
            filterUrlSets[filterName].add(item.url);
          }
        } catch (error) {
          // Filter function failed, skip this item
        }
      });
    }
  });

  Object.keys(filterUrlSets).forEach((filterName) => {
    filterCounts[filterName] = filterUrlSets[filterName].size;
  });
  filterCounts.all = uniqueNonSvgUrls.size;

  processedDataCache = {
    filterCounts,
    totalCount: uniqueMediaUrls.size,
  };
  lastProcessedDataHash = currentHash;

  return processedDataCache;
}

export function clearProcessedDataCache() {
  processedDataCache = null;
  lastProcessedDataHash = null;
}
