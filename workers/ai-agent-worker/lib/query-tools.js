// workers/ai-agent-worker/query-tools.js
// AI Query Tools - Database queries and tool definitions

// ============================================================================
// CONFIGURATION
// ============================================================================

// UI uses lit-virtualizer - can efficiently handle 1000s of items
// Only render visible items, so no performance penalty
const QUERY_LIMITS = {
  DEFAULT: 1000, // Increased for virtualizer (was 100)
  LARGE_IMAGES: 500, // Increased (was 50)
  PAGE_IMAGES: 500, // Increased (was 200)

  // For RAG/conversational queries (future)
  RAG_CONTEXT: 5, // Top 5 most relevant for LLM context
  RAG_SUGGESTIONS: 10, // Top 10 similar for recommendations
};

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

export async function getImagesWithoutAlt(db, siteKey) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height, 
           COUNT(*) as occurrences
    FROM media
    WHERE site_key = ? AND alt IS NULL
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getDecorativeImages(db, siteKey) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences
    FROM media
    WHERE site_key = ? AND alt = ''
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getPageImages(db, siteKey, pageUrl) {
  const stmt = db.prepare(`
    SELECT hash, url, page_url, alt, width, height, loading, fetchpriority, is_lazy_loaded
    FROM media
    WHERE site_key = ? AND page_url = ?
    ORDER BY width * height DESC
    LIMIT ?
  `).bind(siteKey, pageUrl, QUERY_LIMITS.PAGE_IMAGES);

  const result = await stmt.all();
  return result.results;
}

export async function getLargeImages(db, siteKey, minWidth = 1000) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences
    FROM media
    WHERE site_key = ? AND width >= ?
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, minWidth, QUERY_LIMITS.LARGE_IMAGES);

  const result = await stmt.all();
  return result.results;
}

export async function getLazyLoadedImages(db, siteKey) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences
    FROM media
    WHERE site_key = ? AND (loading = 'lazy' OR is_lazy_loaded = 1)
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getSeoIssues(db, siteKey) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
      COUNT(*) as occurrences,
      CASE 
        WHEN MAX(CASE WHEN alt IS NULL THEN 1 ELSE 0 END) = 1 THEN 'missing_alt'
        WHEN MAX(width) > 2000 OR MAX(height) > 2000 THEN 'oversized'
        WHEN MAX(CASE WHEN loading IS NULL THEN 1 ELSE 0 END) = 1 THEN 'missing_loading'
        ELSE 'ok'
      END as issue_type
    FROM media
    WHERE site_key = ?
      AND (alt IS NULL OR width > 2000 OR height > 2000 OR loading IS NULL)
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getMostUsedImages(db, siteKey, limit = 10) {
  const stmt = db.prepare(`
    SELECT 
      url,
      COUNT(*) as usage_count,
      COUNT(DISTINCT page_url) as page_count,
      MAX(width) as max_width,
      MAX(height) as max_height
    FROM media
    WHERE site_key = ?
    GROUP BY url
    ORDER BY usage_count DESC
    LIMIT ?
  `).bind(siteKey, limit);

  const result = await stmt.all();
  return result.results;
}

export async function getImageOccurrences(db, siteKey, imageUrl) {
  const stmt = db.prepare(`
    SELECT hash, url, page_url, alt, width, height, loading, parent_tag, is_lazy_loaded
    FROM media
    WHERE site_key = ? AND url = ?
    ORDER BY page_url, indexed_at
    LIMIT ?
  `).bind(siteKey, imageUrl, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getOrientationImages(db, siteKey, orientation) {
  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences
    FROM media
    WHERE site_key = ? AND orientation = ?
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, orientation, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getTypeMedia(db, siteKey, mediaType) {
  const typePatterns = {
    videos: 'video >%',
    documents: 'document >%',
    links: 'link >%',
    icons: '%svg',
  };

  const pattern = typePatterns[mediaType] || mediaType;

  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences, type
    FROM media
    WHERE site_key = ? AND type LIKE ?
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, pattern, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getFormatImages(db, siteKey, format) {
  const formatPattern = `%${format.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT url, MAX(width) as width, MAX(height) as height,
           COUNT(*) as occurrences, type
    FROM media
    WHERE site_key = ? AND LOWER(url) LIKE ?
    GROUP BY url
    ORDER BY MAX(width * height) DESC
    LIMIT ?
  `).bind(siteKey, formatPattern, QUERY_LIMITS.DEFAULT);

  const result = await stmt.all();
  return result.results;
}

export async function getFilterCounts(db, siteKey) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(DISTINCT url) as total,
      COUNT(DISTINCT CASE WHEN type LIKE 'img >%' AND type NOT LIKE '%svg' THEN url END) as images,
      COUNT(DISTINCT CASE WHEN type LIKE 'video >%' THEN url END) as videos,
      COUNT(DISTINCT CASE WHEN type LIKE 'document >%' THEN url END) as documents,
      COUNT(DISTINCT CASE WHEN type LIKE 'link >%' AND type NOT LIKE '%svg' THEN url END) as links,
      COUNT(DISTINCT CASE WHEN type LIKE '%svg' THEN url END) as icons,
      COUNT(DISTINCT CASE WHEN type LIKE 'img >%' AND type NOT LIKE '%svg' AND alt IS NULL THEN url END) as empty,
      COUNT(DISTINCT CASE WHEN type LIKE 'img >%' AND type NOT LIKE '%svg' AND alt = '' THEN url END) as decorative,
      COUNT(DISTINCT CASE WHEN type LIKE 'img >%' AND type NOT LIKE '%svg' AND alt IS NOT NULL AND alt != '' THEN url END) as filled,
      COUNT(DISTINCT CASE WHEN orientation = 'landscape' THEN url END) as landscape,
      COUNT(DISTINCT CASE WHEN orientation = 'portrait' THEN url END) as portrait,
      COUNT(DISTINCT CASE WHEN orientation = 'square' THEN url END) as square,
      COUNT(DISTINCT CASE WHEN category = 'logos' THEN url END) as logos,
      COUNT(DISTINCT CASE WHEN category = 'people-photos' THEN url END) as people,
      COUNT(DISTINCT CASE WHEN category = 'graphics-ui' THEN url END) as graphics,
      COUNT(DISTINCT CASE WHEN category = 'products' THEN url END) as products,
      COUNT(DISTINCT CASE WHEN category = 'screenshots' THEN url END) as screenshots
    FROM media WHERE site_key = ?
  `).bind(siteKey);

  return await stmt.first();
}

// ============================================================================
// TOOL SCHEMAS FOR AI (Function Calling)
// ============================================================================

const tool = (name, desc, params = {}) => ({
  type: 'function',
  function: {
    name,
    description: desc,
    parameters: { type: 'object', properties: params, required: Object.keys(params).filter((k) => params[k].required) },
  },
});

export const QUERY_TOOLS = [
  tool('getImagesWithoutAlt', 'Get images missing alt text (alt IS NULL). Accessibility issues. Do NOT confuse with decorative (alt="").'),
  tool('getDecorativeImages', 'Get decorative images (alt=""). Intentionally empty per WCAG for decorative content.'),
  tool('getLargeImages', 'Get oversized images above width threshold. For performance optimization.', {
    minWidth: { type: 'number', description: 'Min width in pixels (default 1000)', default: 1000 },
  }),
  tool('getLazyLoadedImages', 'Get images with loading="lazy" attribute. For lazy loading queries.'),
  tool('getPageImages', 'Get all images from a specific page URL.', {
    pageUrl: { type: 'string', description: 'Complete page URL (e.g. https://example.com/about)', required: true },
  }),
  tool('getSeoIssues', 'Get comprehensive SEO audit: missing alt, oversized images, missing lazy loading. For general audits.'),
  tool('getMostUsedImages', 'Get most frequently used images. Shows usage count, page count. For "most used", "top images" queries.', {
    limit: { type: 'number', description: 'Number of results (default 10)', default: 10 },
  }),
  tool('getImageOccurrences', 'Get all occurrences of a specific image URL across pages. Shows alt text per occurrence.', {
    imageUrl: { type: 'string', description: 'Full or partial image URL', required: true },
  }),
  tool('getOrientationImages', 'Get images by orientation. For "show square/landscape/portrait images" queries.', {
    orientation: { type: 'string', description: 'square, landscape, or portrait', enum: ['square', 'landscape', 'portrait'], required: true },
  }),
  tool('getTypeMedia', 'Get media by type. For "show videos/documents/PDFs/icons" queries.', {
    mediaType: { type: 'string', description: 'videos, documents, links, or icons', enum: ['videos', 'documents', 'links', 'icons'], required: true },
  }),
  tool('getFormatImages', 'Get images by file format. For "PNG images", "JPEG files", "WEBP images" queries.', {
    format: { type: 'string', description: 'File format: png, jpg, jpeg, webp, gif, svg, etc.', required: true },
  }),
  tool('getFilterCounts', 'Get ALL filter counts matching sidebar UI. Returns types, accessibility, orientation, categories. For "how many" or "stats".'),
];

// ============================================================================
// TOOL REGISTRY - Maps tool names to implementations
// ============================================================================

export function createToolRegistry(env, siteKey) {
  return {
    getImagesWithoutAlt: () => getImagesWithoutAlt(env.DB, siteKey),
    getDecorativeImages: () => getDecorativeImages(env.DB, siteKey),
    getPageImages: (params) => getPageImages(env.DB, siteKey, params.pageUrl),
    getLargeImages: (params) => getLargeImages(env.DB, siteKey, params.minWidth),
    getLazyLoadedImages: () => getLazyLoadedImages(env.DB, siteKey),
    getSeoIssues: () => getSeoIssues(env.DB, siteKey),
    getMostUsedImages: (params) => getMostUsedImages(env.DB, siteKey, params.limit),
    getImageOccurrences: (params) => getImageOccurrences(env.DB, siteKey, params.imageUrl),
    getFilterCounts: () => getFilterCounts(env.DB, siteKey),
    getOrientationImages: (params) => getOrientationImages(env.DB, siteKey, params.orientation),
    getTypeMedia: (params) => getTypeMedia(env.DB, siteKey, params.mediaType),
    getFormatImages: (params) => getFormatImages(env.DB, siteKey, params.format),
  };
}

export async function executeTool(toolName, params, registry) {
  const tool = registry[toolName];
  if (!tool) {
    return { error: 'Unknown tool' };
  }
  return tool(params);
}
