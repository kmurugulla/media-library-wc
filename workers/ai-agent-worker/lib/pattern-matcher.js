// workers/ai-agent-worker/pattern-matcher.js
// Pattern matching for fallback query detection

import {
  getImagesWithoutAlt,
  getDecorativeImages,
  getLargeImages,
  getLazyLoadedImages,
  getSeoIssues,
  getMostUsedImages,
  getFilterCounts,
  getOrientationImages,
  getTypeMedia,
  getFormatImages,
  getPageImages,
} from './query-tools.js';

const PATTERNS = [
  {
    name: 'fileFormat',
    pattern: /\b(png|jpe?g|webp|gif|svg|bmp|ico|avif)\b/i,
    handler: async (db, siteKey, query) => {
      const formatMatch = query.match(/\b(png|jpe?g|webp|gif|svg|bmp|ico|avif)\b/i);
      const format = formatMatch ? formatMatch[1] : 'png';
      const result = await getFormatImages(db, siteKey, format);
      return { result, tool: 'getFormatImages' };
    },
  },
  {
    name: 'homePage',
    pattern: /\b(home\s*page|homepage|index|root\s*page|landing\s*page|main\s*page)\b/i,
    handler: async (db, siteKey, query) => {
      const baseUrl = `https://${siteKey}/`;
      const result = await getPageImages(db, siteKey, baseUrl);
      return { result, tool: 'getPageImages' };
    },
  },
  {
    name: 'altTextWith',
    pattern: /\b(how\s+many|count|total)\b.*\b(has|have|with)\b.*\balt[\s-]?text\b/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.filled, type: 'images with alt text' }, tool: 'filterCount' };
    },
  },
  {
    name: 'altTextWithout',
    pattern: /\b(how\s+many|count|total)\b.*\b(does\s+not|do\s+not|don't|without|missing|no)\b.*\balt[\s-]?text\b/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.empty, type: 'images without alt text' }, tool: 'filterCount' };
    },
  },
  {
    name: 'decorativeCount',
    pattern: /\b(how\s+many|count|total)\b.*\bdecorative\b/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.decorative, type: 'decorative images' }, tool: 'filterCount' };
    },
  },
  {
    name: 'imageCount',
    pattern: /\b(how\s+many|count|total)\b.*\b(image|photo|picture)/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.images, type: 'images' }, tool: 'filterCount' };
    },
  },
  {
    name: 'videoCount',
    pattern: /\b(how\s+many|count|total)\b.*\b(video|movie)/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.videos, type: 'videos' }, tool: 'filterCount' };
    },
  },
  {
    name: 'squareCount',
    pattern: /\b(how\s+many|count|total)\b.*\bsquare\b/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.square, type: 'square images' }, tool: 'filterCount' };
    },
  },
  {
    name: 'landscapeCount',
    pattern: /\b(how\s+many|count|total)\b.*\b(landscape|horizontal)/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.landscape, type: 'landscape images' }, tool: 'filterCount' };
    },
  },
  {
    name: 'portraitCount',
    pattern: /\b(how\s+many|count|total)\b.*\b(portrait|vertical)/i,
    handler: async (db, siteKey) => {
      const counts = await getFilterCounts(db, siteKey);
      return { result: { count: counts.portrait, type: 'portrait images' }, tool: 'filterCount' };
    },
  },
  {
    name: 'missingAlt',
    pattern: /\b(missing|without|no)\s+(alt|alt[\s-]text)\b/,
    handler: async (db, siteKey) => {
      const result = await getImagesWithoutAlt(db, siteKey);
      return { result, tool: 'getImagesWithoutAlt' };
    },
  },
  {
    name: 'decorative',
    pattern: /\bdecorative\b/,
    handler: async (db, siteKey) => {
      const result = await getDecorativeImages(db, siteKey);
      return { result, tool: 'getDecorativeImages' };
    },
  },
  {
    name: 'landscapeImages',
    pattern: /\b(show|find|get|list|display)\b.*\b(landscape|horizontal)\b/i,
    handler: async (db, siteKey) => {
      const result = await getOrientationImages(db, siteKey, 'landscape');
      return { result, tool: 'getOrientationImages' };
    },
  },
  {
    name: 'portraitImages',
    pattern: /\b(show|find|get|list|display)\b.*\b(portrait|vertical)\b/i,
    handler: async (db, siteKey) => {
      const result = await getOrientationImages(db, siteKey, 'portrait');
      return { result, tool: 'getOrientationImages' };
    },
  },
  {
    name: 'squareImages',
    pattern: /\b(show|find|get|list|display)\b.*\bsquare\b/i,
    handler: async (db, siteKey) => {
      const result = await getOrientationImages(db, siteKey, 'square');
      return { result, tool: 'getOrientationImages' };
    },
  },
  {
    name: 'videos',
    pattern: /\b(show|find|get|list|display)\b.*\b(video|movie)/i,
    handler: async (db, siteKey) => {
      const result = await getTypeMedia(db, siteKey, 'videos');
      return { result, tool: 'getTypeMedia' };
    },
  },
  {
    name: 'documents',
    pattern: /\b(show|find|get|list|display)\b.*\b(document|pdf)/i,
    handler: async (db, siteKey) => {
      const result = await getTypeMedia(db, siteKey, 'documents');
      return { result, tool: 'getTypeMedia' };
    },
  },
  {
    name: 'icons',
    pattern: /\b(show|find|get|list|display)\b.*\b(icon|svg)/i,
    handler: async (db, siteKey) => {
      const result = await getTypeMedia(db, siteKey, 'icons');
      return { result, tool: 'getTypeMedia' };
    },
  },
  {
    name: 'filterCounts',
    pattern: /\b(breakdown|summary|all\s+counts?|filter\s+counts?|stats)\b/,
    handler: async (db, siteKey) => {
      const result = await getFilterCounts(db, siteKey);
      return { result, tool: 'getFilterCounts' };
    },
  },
  {
    name: 'mostUsed',
    pattern: /\b(most|top|frequently|commonly|highest)[\s-]*(used|referenced|popular)\b/,
    handler: async (db, siteKey, query) => {
      const limitMatch = query.match(/top\s+(\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1], 10) : 10;
      const result = await getMostUsedImages(db, siteKey, limit);
      return { result, tool: 'getMostUsedImages' };
    },
  },
  {
    name: 'largeImages',
    pattern: /\b(largest|biggest|oversized|big|heavy|large)\b/,
    handler: async (db, siteKey) => {
      const result = await getLargeImages(db, siteKey);
      return { result, tool: 'getLargeImages' };
    },
  },
  {
    name: 'lazyLoading',
    pattern: /\b(lazy|loading)\b/,
    handler: async (db, siteKey) => {
      const result = await getLazyLoadedImages(db, siteKey);
      return { result, tool: 'getLazyLoadedImages' };
    },
  },
  {
    name: 'seoIssues',
    pattern: /\b(seo|issue|problem|audit)\b/,
    handler: async (db, siteKey) => {
      const result = await getSeoIssues(db, siteKey);
      return { result, tool: 'getSeoIssues' };
    },
  },
];

export default async function matchPattern(query, db, siteKey) {
  const lowerQuery = query.toLowerCase();

  for (const pattern of PATTERNS) {
    if (lowerQuery.match(pattern.pattern)) {
      return pattern.handler(db, siteKey, query);
    }
  }

  return null;
}
