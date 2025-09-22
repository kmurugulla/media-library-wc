import { getAvailableCategories } from './category-detector.js';
// import { normalizeUrl, urlsMatch } from './utils.js'; // Unused imports

function extractFileExtension(filePath) {
  return filePath?.split('.').pop()?.toLowerCase();
}

export function getGroupingKey(url) {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    const { pathname } = urlObj;
    const filename = pathname.split('/').pop();

    // For media files with specific patterns, use just the filename
    if (filename && filename.includes('media_')) {
      return filename;
    }

    // For other files, use the full pathname
    return pathname;
  } catch {
    return url;
  }
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

// New function that uses processed data indexes for fast filtering
export function calculateFilteredMediaDataFromIndex(
  mediaData,
  processedData,
  selectedFilterType,
  searchQuery,
  selectedDocument,
) {
  if (!mediaData || mediaData.length === 0 || !processedData) {
    return [];
  }

  let filteredData = [...mediaData];

  // Apply search filter first (still need to scan for search)
  if (searchQuery && searchQuery.trim()) {
    const colonSyntax = parseColonSyntax(searchQuery);
    if (colonSyntax) {
      filteredData = filterByColonSyntax(filteredData, colonSyntax);
    } else {
      filteredData = filterBySearchQuery(filteredData, searchQuery);
    }
  }

  // Apply filter using pre-computed indexes
  if (selectedFilterType && selectedFilterType !== 'all') {
    const filterHashes = processedData.filterArrays[selectedFilterType] || [];
    const filteredHashes = new Set(filterHashes);

    // Filter by document if needed
    if (selectedDocument && selectedFilterType.startsWith('document')) {
      filteredData = filteredData.filter((item) => (
        filteredHashes.has(item.hash) && item.doc === selectedDocument
      ));
    } else {
      filteredData = filteredData.filter((item) => filteredHashes.has(item.hash));
    }
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

// Chunk array utility for batch processing
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function initializeProcessedData() {
  const filterArrays = {};
  const usageData = {};
  const searchIndex = {
    name: {},
    alt: {},
    doc: {},
    ctx: {},
    url: {},
  };
  const filterCounts = {};

  Object.keys(FILTER_CONFIG).forEach((filterName) => {
    if (!filterName.startsWith('document')) {
      filterArrays[filterName] = [];
    }
  });

  return {
    filterArrays,
    usageData,
    searchIndex,
    filterCounts,
    totalCount: 0,
  };
}

export async function processMediaData(mediaData, onProgress = null) {
  if (!mediaData || mediaData.length === 0) {
    return initializeProcessedData();
  }

  const currentHash = createDataHash(mediaData);
  if (processedDataCache && lastProcessedDataHash === currentHash) {
    return processedDataCache;
  }

  const processedData = initializeProcessedData();
  const uniqueMediaUrls = new Set();
  const uniqueNonSvgUrls = new Set();

  // Use smaller batch size for very large datasets to prevent UI blocking
  const batchSize = mediaData.length > 100000 ? 500 : 1000;
  const batches = chunkArray(mediaData, batchSize);
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];

    batch.forEach((item) => {
      if (!item.hash) return;

      if (item.url) {
        const groupingKey = getGroupingKey(item.url);
        if (!processedData.usageData[groupingKey]) {
          processedData.usageData[groupingKey] = {
            hashes: [],
            uniqueDocs: new Set(),
            count: 0,
          };
        }
        processedData.usageData[groupingKey].hashes.push(item.hash);
        if (item.doc) {
          processedData.usageData[groupingKey].uniqueDocs.add(item.doc);
        }
        const usageData = processedData.usageData[groupingKey];
        usageData.count = usageData.hashes.length;
      }

      if (item.name) {
        const nameKey = item.name.toLowerCase();
        if (!processedData.searchIndex.name[nameKey]) {
          processedData.searchIndex.name[nameKey] = [];
        }
        processedData.searchIndex.name[nameKey].push(item.hash);
      }

      if (item.alt) {
        const altKey = item.alt.toLowerCase();
        if (!processedData.searchIndex.alt[altKey]) {
          processedData.searchIndex.alt[altKey] = [];
        }
        processedData.searchIndex.alt[altKey].push(item.hash);
      }

      if (item.doc) {
        const docKey = item.doc.toLowerCase();
        if (!processedData.searchIndex.doc[docKey]) {
          processedData.searchIndex.doc[docKey] = [];
        }
        processedData.searchIndex.doc[docKey].push(item.hash);
      }

      if (item.ctx) {
        const ctxKey = item.ctx.toLowerCase();
        if (!processedData.searchIndex.ctx[ctxKey]) {
          processedData.searchIndex.ctx[ctxKey] = [];
        }
        processedData.searchIndex.ctx[ctxKey].push(item.hash);
      }

      if (item.url) {
        const urlKey = item.url.toLowerCase();
        if (!processedData.searchIndex.url[urlKey]) {
          processedData.searchIndex.url[urlKey] = [];
        }
        processedData.searchIndex.url[urlKey].push(item.hash);
      }

      Object.keys(processedData.filterArrays).forEach((filterName) => {
        try {
          if (FILTER_CONFIG[filterName](item)) {
            processedData.filterArrays[filterName].push(item.hash);
          }
        } catch (error) {
          // Filter function failed, skip this item
        }
      });

      if (item.url) {
        uniqueMediaUrls.add(item.url);
        if (!isSvgFile(item)) {
          uniqueNonSvgUrls.add(item.url);
        }
      }
    });

    if (onProgress) {
      onProgress(((i + 1) / totalBatches) * 100);
    }

    // Yield to browser more frequently for large datasets
    if (i < batches.length - 1) {
      if (mediaData.length > 100000 && i % 5 === 0) {
        // For very large datasets, yield every 5 batches
        await new Promise((resolve) => {
          setTimeout(resolve, 1);
        });
      } else {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    }
  }

  // Calculate filter counts based on unique URLs, not all occurrences
  // Create hash-to-item lookup map for O(1) access instead of O(n) find operations
  const hashToItemMap = new Map();
  mediaData.forEach((item) => {
    if (item.hash) {
      hashToItemMap.set(item.hash, item);
    }
  });

  // Add usageCount to each media item during initial processing
  mediaData.forEach((item) => {
    if (item.url) {
      const groupingKey = getGroupingKey(item.url);
      const usageInfo = processedData.usageData[groupingKey];
      if (usageInfo) {
        item.usageCount = usageInfo.count || 1;
      } else {
        item.usageCount = 1;
      }
    } else {
      item.usageCount = 1;
    }
  });
  Object.keys(processedData.filterArrays).forEach((filterName) => {
    const uniqueUrls = new Set();
    processedData.filterArrays[filterName].forEach((hash) => {
      // Use O(1) map lookup instead of O(n) find operation
      const item = hashToItemMap.get(hash);
      if (item && item.url) {
        uniqueUrls.add(item.url);
      }
    });
    processedData.filterCounts[filterName] = uniqueUrls.size;
  });

  // Calculate "all" filter count - should be unique media URLs, not all occurrences
  processedData.filterCounts.all = uniqueNonSvgUrls.size;
  processedData.totalCount = uniqueMediaUrls.size;

  processedDataCache = processedData;
  lastProcessedDataHash = currentHash;

  return processedData;
}

export function clearProcessedDataCache() {
  processedDataCache = null;
  lastProcessedDataHash = null;
}

function mergeSearchIndex(item, searchIndex) {
  if (item.name) {
    const nameKey = item.name.toLowerCase();
    if (!searchIndex.name[nameKey]) {
      searchIndex.name[nameKey] = [];
    }
    if (!searchIndex.name[nameKey].includes(item.hash)) {
      searchIndex.name[nameKey].push(item.hash);
    }
  }

  if (item.alt) {
    const altKey = item.alt.toLowerCase();
    if (!searchIndex.alt[altKey]) {
      searchIndex.alt[altKey] = [];
    }
    if (!searchIndex.alt[altKey].includes(item.hash)) {
      searchIndex.alt[altKey].push(item.hash);
    }
  }

  if (item.doc) {
    const docKey = item.doc.toLowerCase();
    if (!searchIndex.doc[docKey]) {
      searchIndex.doc[docKey] = [];
    }
    if (!searchIndex.doc[docKey].includes(item.hash)) {
      searchIndex.doc[docKey].push(item.hash);
    }
  }

  if (item.ctx) {
    const ctxKey = item.ctx.toLowerCase();
    if (!searchIndex.ctx[ctxKey]) {
      searchIndex.ctx[ctxKey] = [];
    }
    if (!searchIndex.ctx[ctxKey].includes(item.hash)) {
      searchIndex.ctx[ctxKey].push(item.hash);
    }
  }

  if (item.url) {
    const urlKey = item.url.toLowerCase();
    if (!searchIndex.url[urlKey]) {
      searchIndex.url[urlKey] = [];
    }
    if (!searchIndex.url[urlKey].includes(item.hash)) {
      searchIndex.url[urlKey].push(item.hash);
    }
  }
}

function mergeFilterArrays(item, filterArrays) {
  Object.keys(filterArrays).forEach((filterName) => {
    try {
      if (FILTER_CONFIG[filterName](item)) {
        if (!filterArrays[filterName].includes(item.hash)) {
          filterArrays[filterName].push(item.hash);
        }
      }
    } catch (error) {
      // Filter function failed, skip this item
    }
  });
}

function recalculateFilterCounts(processedData) {
  Object.keys(processedData.filterArrays).forEach((filterName) => {
    processedData.filterCounts[filterName] = processedData.filterArrays[filterName].length;
  });
}

export async function processNewItems(newItems, existingProcessedData, onProgress = null) {
  const batchSize = 100;

  for (let i = 0; i < newItems.length; i += batchSize) {
    const batch = newItems.slice(i, i + batchSize);

    batch.forEach((item) => {
      if (!item.hash) return;

      if (item.url) {
        const groupingKey = getGroupingKey(item.url);
        if (!existingProcessedData.usageData[groupingKey]) {
          existingProcessedData.usageData[groupingKey] = {
            hashes: [],
            uniqueDocs: new Set(),
            count: 0,
          };
        }
        if (!existingProcessedData.usageData[groupingKey].hashes.includes(item.hash)) {
          existingProcessedData.usageData[groupingKey].hashes.push(item.hash);
          if (item.doc) {
            existingProcessedData.usageData[groupingKey].uniqueDocs.add(item.doc);
          }
          const existingUsageData = existingProcessedData.usageData[groupingKey];
          existingUsageData.count = existingUsageData.hashes.length;
        }
      }

      mergeSearchIndex(item, existingProcessedData.searchIndex);
      mergeFilterArrays(item, existingProcessedData.filterArrays);

      existingProcessedData.totalCount += 1;
    });

    if (onProgress) {
      onProgress(((i + batchSize) / newItems.length) * 100);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  recalculateFilterCounts(existingProcessedData);
  return existingProcessedData;
}

// New functions to work with processed data structure
export function getFilteredItems(processedData, filterName) {
  if (!processedData || !processedData.filterArrays) {
    return [];
  }

  if (filterName === 'all') {
    return processedData.filterArrays.all || [];
  }

  if (filterName && processedData.filterArrays[filterName]) {
    return processedData.filterArrays[filterName];
  }

  return [];
}

export function getItemByHash(rawData, hash) {
  if (!rawData || !Array.isArray(rawData)) {
    return null;
  }
  return rawData.find((item) => item.hash === hash) || null;
}

export function getUsageData(processedData, url) {
  if (!processedData || !processedData.usageData) {
    return [];
  }

  const groupingKey = getGroupingKey(url);
  const usageInfo = processedData.usageData[groupingKey];

  if (!usageInfo) {
    return [];
  }

  // Return the hashes array for backward compatibility
  return usageInfo.hashes || [];
}

export function searchProcessedData(processedData, query) {
  if (!processedData || !processedData.searchIndex || !query) {
    return [];
  }

  const lowerQuery = query.toLowerCase().trim();
  const results = new Set();

  // Search across all indexes
  Object.keys(processedData.searchIndex).forEach((field) => {
    const index = processedData.searchIndex[field];
    Object.keys(index).forEach((key) => {
      if (key.includes(lowerQuery)) {
        index[key].forEach((hash) => results.add(hash));
      }
    });
  });

  return Array.from(results);
}

export function getFilterCounts(processedData) {
  if (!processedData || !processedData.filterCounts) {
    return {};
  }
  return processedData.filterCounts;
}

export async function updateUsageCounts(items, processedData, progressCallback) {
  if (!items || items.length === 0) return;

  const batchSize = 100;
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (const item of batch) {
      const { hash } = item;
      if (!hash) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Update usage count for this hash
      if (!processedData.usageData[hash]) {
        processedData.usageData[hash] = {
          count: 0,
          urls: new Set(),
          docs: new Set(),
        };
      }

      processedData.usageData[hash].count += 1;
      if (item.url) processedData.usageData[hash].urls.add(item.url);
      if (item.doc) processedData.usageData[hash].docs.add(item.doc);
    }

    processed += batch.length;

    if (progressCallback) {
      progressCallback((processed / items.length) * 100);
    }

    // Small delay to prevent UI blocking
    if (i + batchSize < items.length) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
    }
  }
}
