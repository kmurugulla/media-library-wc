// src/utils/filters.js
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

  // Calculate counts for each filter
  Object.keys(FILTER_CONFIG).forEach(filterName => {
    if (filterName.startsWith('document')) {
      // Skip document-specific filters for general counts
      return;
    }
    
    const count = mediaData.filter(item => {
      try {
        return FILTER_CONFIG[filterName](item);
      } catch {
        return false;
      }
    }).length;
    
    filterCounts[filterName] = count;
  });

  // Calculate total count (excluding SVGs for "all" filter)
  filterCounts.all = mediaData.filter(item => !isSvgFile(item)).length;

  return {
    filterCounts,
    totalCount: mediaData.length
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
