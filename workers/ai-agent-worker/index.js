// workers/ai-agent-worker/index.js
// AI Assistant Worker - Streaming RAG + Query Tools with Workers AI

// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from 'node-html-parser';
import {
  SUGGESTED_QUESTIONS,
  getAltTextSystemPrompt,
  getAltTextUserPrompt,
  extractKeywordsFromContext,
  calculateImpact,
} from './lib/ai-prompts.js';
import {
  QUERY_TOOLS,
  createToolRegistry,
} from './lib/query-tools.js';
import matchPattern from './lib/pattern-matcher.js';
import {
  getSurroundingText,
  getNearestHeading,
  getSectionContext,
} from './lib/html-context.js';
import {
  createJsonResponse,
  createErrorResponse,
  withErrorHandling,
} from './lib/response-utils.js';
import {
  AI_MODELS,
  CORS_HEADERS,
  CACHE_CONFIG,
  BATCH_CONFIG,
} from './lib/constants.js';

async function handleDeepAnalysis(request, env) {
  const { imageUrl, pageUrl, occurrence = 0, siteKey } = await request.json();

  if (!imageUrl || !pageUrl || !siteKey) {
    return createJsonResponse({ error: 'imageUrl, pageUrl, and siteKey are required' }, 400);
  }

  const cacheKey = `analysis:${siteKey}:${pageUrl}:${imageUrl}:${occurrence}`;
  const cached = await env.CACHE.get(cacheKey, { type: 'json' });

  if (cached) {
    return createJsonResponse({ ...cached, cached: true });
  }

  const proxyUrl = `${env.CORS_PROXY_URL}?url=${encodeURIComponent(pageUrl)}`;
  const pageResponse = await fetch(proxyUrl);

  if (!pageResponse.ok) {
    return createJsonResponse({
      error: 'Failed to fetch page HTML',
      status: pageResponse.status,
    }, 502);
  }

  const html = await pageResponse.text();
  const doc = parse(html);

  const allImages = doc.querySelectorAll(`img[src*="${imageUrl}"], img[data-src*="${imageUrl}"]`);

  if (!allImages || allImages.length === 0) {
    return createJsonResponse({ error: 'Image not found on page' }, 404);
  }

  if (occurrence >= allImages.length) {
    return createJsonResponse({ error: `Occurrence ${occurrence} not found. Only ${allImages.length} instances exist.` }, 404);
  }

  const targetImg = allImages[occurrence];

  const context = {
    surroundingText: getSurroundingText(targetImg, 200),
    parentElement: targetImg.parentNode?.tagName || 'unknown',
    nearestHeading: getNearestHeading(targetImg),
    sectionContext: getSectionContext(targetImg),
    currentAlt: targetImg.getAttribute('alt'),
  };

  const pageKeywords = extractKeywordsFromContext(context);

  const systemPrompt = getAltTextSystemPrompt();
  const userPrompt = getAltTextUserPrompt(context, pageKeywords);

  const aiResponse = await env.AI.run(AI_MODELS.LLM, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  let aiData;
  try {
    const responseText = aiResponse.response?.trim() || '{}';
    aiData = JSON.parse(responseText);
  } catch {
    aiData = {
      suggestedAlt: aiResponse.response?.trim() || 'Unable to generate alt text',
      reasoning: 'Generated using basic prompt',
      wcagCompliance: '1.1.1',
      type: 'informative',
      keywords: pageKeywords,
      confidence: 0.7,
    };
  }

  const impact = calculateImpact(
    context.currentAlt || '',
    aiData.suggestedAlt || '',
    context,
    pageKeywords,
  );

  const result = {
    suggestedAlt: aiData.suggestedAlt || 'Unable to generate alt text',
    reasoning: aiData.reasoning || '',
    wcagCompliance: aiData.wcagCompliance || '1.1.1',
    type: aiData.type || 'informative',
    keywords: aiData.keywords || pageKeywords,
    confidence: aiData.confidence || 0.7,
    impact,
    pageContext: context,
    occurrence,
    totalOccurrences: allImages.length,
  };

  const cacheTTL = parseInt(env.CACHE_TTL_SECONDS || String(CACHE_CONFIG.DEFAULT_TTL_SECONDS), 10);
  await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: cacheTTL });

  return createJsonResponse(result);
}

async function handleIndexBatch(request, env) {
  const { batch, siteKey } = await request.json();

  if (!siteKey || !Array.isArray(batch)) {
    return createJsonResponse({ error: 'siteKey and batch array required' }, 400);
  }

  if (batch.length === 0) {
    return createJsonResponse({ success: true, indexed: 0, embeddings: 0 });
  }

  const missingFields = [];
  batch.forEach((item, idx) => {
    if (!item.hash) missingFields.push(`batch[${idx}].hash`);
    if (!item.url) missingFields.push(`batch[${idx}].url`);
    if (!item.doc) missingFields.push(`batch[${idx}].doc`);
  });

  if (missingFields.length > 0) {
    return createJsonResponse({
      error: 'Missing required fields in batch',
      details: missingFields.slice(0, 10),
    }, 400);
  }

  const timestamp = Date.now();
  const maxBatchSize = parseInt(env.MAX_BATCH_SIZE || String(BATCH_CONFIG.MAX_BATCH_SIZE), 10);

  const chunks = [];
  for (let i = 0; i < batch.length; i += maxBatchSize) {
    chunks.push(batch.slice(i, i + maxBatchSize));
  }

  let totalIndexed = 0;
  let totalEmbeddings = 0;

  for (const chunk of chunks) {
    const stmt = env.DB.prepare(`
      INSERT OR REPLACE INTO media 
      (site_key, hash, url, page_url, type, alt, width, height, orientation, category,
       loading, fetchpriority, is_lazy_loaded, role, aria_hidden, parent_tag, has_figcaption, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const inserts = chunk.map((item) => stmt.bind(
      siteKey,
      item.hash,
      item.url,
      item.doc,
      item.type || null,
      item.alt === undefined ? null : item.alt,
      item.width || null,
      item.height || null,
      item.orientation || null,
      item.category || null,
      item.loading || null,
      item.fetchpriority || null,
      item.isLazyLoaded ? 1 : 0,
      item.role || null,
      item.ariaHidden ? 1 : 0,
      item.parentTag || null,
      item.hasFigcaption ? 1 : 0,
      timestamp,
    ));

    try {
      await env.DB.batch(inserts);
      totalIndexed += chunk.length;
    } catch (dbError) {
      return createJsonResponse({
        error: 'D1 batch insert failed',
        details: dbError.message,
        chunkSize: chunk.length,
        sampleItem: chunk[0],
      }, 500);
    }

    const itemsWithAlt = chunk.filter((item) => item.alt && item.alt.trim());

    if (itemsWithAlt.length > 0) {
      const embeddingPromises = itemsWithAlt.map(async (item) => {
        try {
          const embedding = await env.AI.run(AI_MODELS.EMBEDDING, { text: item.alt });

          return {
            id: item.hash,
            values: embedding.data[0],
            metadata: {
              site_key: siteKey,
              url: item.url,
              page_url: item.doc,
              alt: item.alt,
            },
          };
        } catch {
          return null;
        }
      });

      const embeddings = (await Promise.all(embeddingPromises)).filter((e) => e !== null);

      if (embeddings.length > 0) {
        try {
          await env.VECTORIZE.upsert(embeddings);
          totalEmbeddings += embeddings.length;
        } catch {
          // Continue on vectorize errors
        }
      }
    }
  }

  return createJsonResponse({
    success: true,
    indexed: totalIndexed,
    embeddings: totalEmbeddings,
    chunks: chunks.length,
  });
}

function handleSuggestedQuestions() {
  return createJsonResponse({
    categories: Object.keys(SUGGESTED_QUESTIONS).map((key) => ({
      id: key,
      name: SUGGESTED_QUESTIONS[key].name,
      questions: SUGGESTED_QUESTIONS[key].questions,
    })),
  });
}

function handleHealth(env) {
  return createJsonResponse({
    status: 'ok',
    timestamp: Date.now(),
    bindings: {
      ai: !!env.AI,
      db: !!env.DB,
      vectorize: !!env.VECTORIZE,
      cache: !!env.CACHE,
    },
  });
}

async function handleDeleteBatch(request, env) {
  const { siteKey, hashes } = await request.json();

  if (!siteKey || !hashes || !Array.isArray(hashes)) {
    return createJsonResponse({ error: 'siteKey and hashes array are required' }, 400);
  }

  if (hashes.length === 0) {
    return createJsonResponse({ success: true, deleted: 0 });
  }

  const placeholders = hashes.map(() => '?').join(',');
  const stmt = env.DB.prepare(`
    DELETE FROM media 
    WHERE site_key = ? AND hash IN (${placeholders})
  `);

  await stmt.bind(siteKey, ...hashes).run();
  await env.VECTORIZE.deleteByIds(hashes);

  return createJsonResponse({
    success: true,
    deleted: hashes.length,
  });
}

async function handleClearSite(request, env) {
  const { siteKey } = await request.json();

  if (!siteKey) {
    return createJsonResponse({ error: 'siteKey is required' }, 400);
  }

  const result = await env.DB.prepare(
    'SELECT hash FROM media WHERE site_key = ?',
  ).bind(siteKey).all();

  const hashes = result.results.map((row) => row.hash);

  await env.DB.prepare('DELETE FROM media WHERE site_key = ?').bind(siteKey).run();

  if (hashes.length > 0) {
    await env.VECTORIZE.deleteByIds(hashes);
  }

  return createJsonResponse({
    success: true,
    deleted: hashes.length,
  });
}

async function handleGetCount(request, env) {
  const url = new URL(request.url);
  const siteKey = url.searchParams.get('siteKey');

  if (!siteKey) {
    return createJsonResponse({ error: 'siteKey query parameter is required' }, 400);
  }

  const result = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM media WHERE site_key = ?',
  ).bind(siteKey).first();

  return createJsonResponse({
    siteKey,
    count: result?.count || 0,
  });
}

async function semanticSearch(query, env, siteKey, limit = 20) {
  const embedding = await env.AI.run(AI_MODELS.EMBEDDING, { text: query });
  const matches = await env.VECTORIZE.query(embedding.data[0], { topK: limit });

  if (!matches.matches || matches.matches.length === 0) return [];

  const hashes = matches.matches.map((m) => m.id);
  const placeholders = hashes.map(() => '?').join(',');
  const stmt = env.DB.prepare(`
    SELECT DISTINCT url, alt, width, height, type, orientation, category, 
           COUNT(*) as occurrences, 
           GROUP_CONCAT(DISTINCT page_url) as pages
    FROM media 
    WHERE site_key = ? AND hash IN (${placeholders})
    GROUP BY url
    ORDER BY occurrences DESC
  `).bind(siteKey, ...hashes);

  const { results } = await stmt.all();
  return results || [];
}

async function handleStreamingChat(request, env) {
  const { query, siteKey, conversationHistory = [] } = await request.json();

  if (!siteKey) {
    return createJsonResponse({ error: 'siteKey is required' }, 400);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const writeData = (data) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const stream = async () => {
    try {
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.match(/\b(help|what.*can.*answer|what.*questions|capabilities)\b/)) {
        const response = `I can help you analyze images on **${siteKey}**. Here's what I can do:\n\n`
          + '🔍 **Find Issues:**\n'
          + '• Images missing alt text\n'
          + '• Oversized images (performance issues)\n'
          + '• Images without lazy loading\n'
          + '• Decorative images (alt="")\n'
          + '• Comprehensive SEO audits\n\n'
          + '🧠 **Semantic Search:**\n'
          + '• "Show me product images"\n'
          + '• "Find images with people"\n'
          + '• "Display team photos"\n\n'
          + '💬 **Quick Queries:**\n'
          + '• "Which images are missing alt text?"\n'
          + '• "Show me videos"\n'
          + '• "How many square images?"\n'
          + '• "Give me all filter counts"\n\n'
          + 'Ask naturally - I understand context from previous questions!';

        writeData({ chunk: response });
        writeData({ chunk: '', done: true });
        await writer.close();
        return;
      }

      let toolResult = null;
      let toolName = null;

      const systemPrompt = `You are a helpful image analysis assistant. Based on the conversation context and user's query, call the appropriate function to retrieve data.

Available functions:
- getImagesWithoutAlt: Find images missing alt text
- getDecorativeImages: Find images with empty alt (alt="")
- getLargeImages: Find oversized images
- getLazyLoadedImages: Find images with lazy loading
- getSeoIssues: Find SEO problems
- getOrientationImages: Find images by orientation (square/landscape/portrait)
- getMostUsedImages: Find most frequently used images
- getFilterCounts: Get ALL filter counts (use for "breakdown", "stats", "all counts")
- getTypeMedia: Find videos, documents, links, or icons
- getFormatImages: Find images by file format (PNG, JPG, WEBP, GIF, SVG, etc.)
- getPageImages: Find images from a specific page URL (e.g., "home page" = https://example.com/)

Important notes:
- For "home page" queries, use getPageImages with the root URL (e.g., https://superlist.com/)
- For file format queries like "PNG images", use getFormatImages with format="png"
- Use conversation context to understand follow-up questions like "how about X?" or "show me those"

Call the most appropriate function based on the user's query.`;

      try {
        const llmResponse = await env.AI.run(AI_MODELS.LLM, {
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-4),
            { role: 'user', content: query },
          ],
          tools: QUERY_TOOLS,
          temperature: 0.1,
          max_tokens: 150,
        });

        if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
          const toolCall = llmResponse.tool_calls[0];
          toolName = toolCall.function?.name;
          const params = toolCall.function?.arguments || {};

          const toolRegistry = createToolRegistry(env, siteKey);
          toolResult = await toolRegistry[toolName]?.(params);
        }
      } catch (llmError) {
        // LLM failed, fall back to pattern matching
      }

      if (!toolResult) {
        const match = await matchPattern(query, env.DB, siteKey);
        if (match) {
          toolResult = match.result;
          toolName = match.tool;
        }
      }

      if (!toolResult && lowerQuery.match(/\b(product|people|team|logo|similar|like)\b/)) {
        toolResult = await semanticSearch(query, env, siteKey);
        if (toolResult.length > 0) {
          toolName = 'semanticSearch';
        } else {
          toolResult = null;
        }
      }

      if (toolResult !== null) {
        if (toolName === 'filterCount') {
          const { count, type } = toolResult;
          const response = count > 0
            ? `There are **${count} ${type}** on **${siteKey}**.`
            : `No ${type} found on **${siteKey}**.`;
          writeData({ chunk: response, tool: toolName, count });
        } else if (toolName === 'orientationCount') {
          const { count, type } = toolResult;
          const response = count > 0
            ? `There are **${count} ${type} images** on **${siteKey}**.`
            : `No ${type} images found on **${siteKey}**.`;
          writeData({ chunk: response, tool: toolName, count });
        } else if (toolName === 'getFilterCounts') {
          const intro = `Here are the filter counts for **${siteKey}**, exactly matching your sidebar:\n\n`;
          writeData({ chunk: intro, tool: toolName });

          const response = '📊 **TYPES**\n'
            + `• All Media: **${toolResult.total}**\n`
            + `• Images: **${toolResult.images}**\n`
            + `• Videos: **${toolResult.videos}**\n`
            + `• Links: **${toolResult.links}**\n`
            + `• SVGs: **${toolResult.icons}**\n\n`
            + '♿ **ACCESSIBILITY**\n'
            + `• Filled: **${toolResult.filled}**\n`
            + `• Decorative: **${toolResult.decorative}**\n`
            + `• Empty: **${toolResult.empty}**\n\n`
            + '📐 **ORIENTATION**\n'
            + `• Landscape: **${toolResult.landscape}**\n`
            + `• Portrait: **${toolResult.portrait}**\n`
            + `• Square: **${toolResult.square}**\n\n`
            + '🏷️ **CATEGORIES**\n'
            + `• Graphics & UI: **${toolResult.graphics}**\n`
            + `• Logos: **${toolResult.logos}**\n`
            + `• People: **${toolResult.people}**\n`
            + `• Products: **${toolResult.products}**\n`
            + `• Screenshots: **${toolResult.screenshots}**`;

          writeData({ chunk: response });
        } else if (Array.isArray(toolResult) && toolResult.length > 0) {
          const intro = toolName === 'semanticSearch'
            ? `Found **${toolResult.length} relevant images** matching your query.`
            : `Found **${toolResult.length} images**.`;
          writeData({ chunk: intro, tool: toolName, count: toolResult.length });

          if (toolName === 'getImageOccurrences') {
            const examples = toolResult.slice(0, 5).map((img, i) => `\n${i + 1}. \`${img.url}\`\n   📄 Page: ${img.page_url}\n   🏷️ Alt: ${img.alt || '❌ Missing'}\n   📏 Size: ${img.width}×${img.height}px\n`).join('\n');
            writeData({ chunk: examples });

            if (toolResult.length > 5) {
              const more = `\n...and **${toolResult.length - 5} more** occurrences.`;
              writeData({ chunk: more });
            }
          } else {
            writeData({ chunk: ' Preview below:\n\n', images: toolResult });
          }
        } else {
          let emptyMessage = '';
          if (toolName === 'getImagesWithoutAlt') {
            emptyMessage = `✅ Great news! All images on **${siteKey}** have alt text. No accessibility issues found!`;
          } else if (toolName === 'getDecorativeImages') {
            emptyMessage = `No decorative images found on **${siteKey}**. This means no images are using \`alt=""\` (which is used for purely decorative content per WCAG guidelines).`;
          } else if (toolName === 'getLargeImages') {
            emptyMessage = `✅ No oversized images found! All images on **${siteKey}** are optimally sized for performance.`;
          } else if (toolName === 'getLazyLoadedImages') {
            emptyMessage = `No images with lazy loading detected on **${siteKey}**. Consider adding \`loading="lazy"\` to improve page performance!`;
          } else {
            emptyMessage = `No results found for your query on **${siteKey}**.`;
          }
          writeData({ chunk: emptyMessage, tool: toolName, count: 0 });
        }
      } else {
        const helpMessage = 'I couldn\'t find a specific answer for that query. Here\'s what I can help with:\n\n'
          + '• **\'how many images?\'** - Get image counts\n'
          + '• **\'show me videos\'** - Display videos\n'
          + '• **\'missing alt text\'** - Find accessibility issues\n'
          + '• **\'large images\'** - Find oversized images\n'
          + '• **\'product images\'** - Semantic search (uses AI)\n\n'
          + 'Try rephrasing your question to match one of these patterns!';

        writeData({ chunk: helpMessage, tool: 'help', count: 0 });
      }

      writeData({ chunk: '', done: true });
      await writer.close();
    } catch (error) {
      writeData({ error: error.message });
      await writer.close();
    }
  };

  stream();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}

async function handleGetSites(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const stmt = env.DB.prepare(`
    SELECT 
      site_key,
      COUNT(*) as count,
      MAX(indexed_at) as last_indexed
    FROM media
    GROUP BY site_key
    ORDER BY last_indexed DESC
    LIMIT ?
  `).bind(limit);

  const { results } = await stmt.all();

  return createJsonResponse({
    sites: results,
    count: results.length,
  });
}

function handleNotFound() {
  return createJsonResponse({
    error: 'Not found',
    availableEndpoints: [
      'POST /api/ai/chat',
      'POST /api/ai/analyze',
      'POST /api/ai/index-batch',
      'POST /api/ai/delete-batch',
      'POST /api/ai/clear-site',
      'GET /api/ai/count',
      'GET /api/ai/sites',
      'GET /api/suggested-questions',
      'GET /api/health',
    ],
  }, 404);
}

function createRouteRegistry(env) {
  return {
    'POST /api/ai/chat': (req) => handleStreamingChat(req, env),
    'POST /api/ai/analyze': withErrorHandling(handleDeepAnalysis),
    'POST /api/ai/index-batch': withErrorHandling(handleIndexBatch),
    'POST /api/ai/delete-batch': withErrorHandling(handleDeleteBatch),
    'POST /api/ai/clear-site': withErrorHandling(handleClearSite),
    'GET /api/ai/count': withErrorHandling(handleGetCount),
    'GET /api/ai/sites': (req) => handleGetSites(req, env),
    'GET /api/suggested-questions': () => handleSuggestedQuestions(),
    'GET /api/health': () => handleHealth(env),
  };
}

async function validateApiKey(request, env) {
  if (env.REQUIRE_API_KEY === 'false' || env.REQUIRE_API_KEY === false) {
    return null;
  }

  const providedKey = request.headers.get('X-API-Key');
  const validKey = env.API_KEY;

  if (!providedKey) {
    return createJsonResponse({ error: 'API key required. Please provide X-API-Key header.' }, 401);
  }

  if (providedKey !== validKey) {
    return createJsonResponse({ error: 'Invalid API key.' }, 403);
  }

  return null;
}

async function checkRateLimit(request, env) {
  if (env.ENABLE_RATE_LIMITING === 'false' || env.ENABLE_RATE_LIMITING === false) {
    return null;
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `ratelimit:${ip}`;

  const currentCount = await env.CACHE.get(rateLimitKey);
  const count = parseInt(currentCount || '0', 10);

  const limit = parseInt(env.RATE_LIMIT_PER_HOUR || '100', 10);

  if (count >= limit) {
    return createJsonResponse(
      {
        error: 'Rate limit exceeded. Please try again later.',
        limit,
        retryAfter: 3600,
      },
      429,
    );
  }

  await env.CACHE.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { method } = request;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === '/api/health') {
        return handleHealth(env);
      }
      if (url.pathname === '/api/suggested-questions') {
        return handleSuggestedQuestions();
      }
      if (url.pathname === '/api/ai/sites') {
        return handleGetSites(request, env);
      }

      const authError = await validateApiKey(request, env);
      if (authError) return authError;

      if (url.pathname.startsWith('/api/ai/')) {
        const rateLimitError = await checkRateLimit(request, env);
        if (rateLimitError) return rateLimitError;
      }

      const routeKey = `${method} ${url.pathname}`;
      const routes = createRouteRegistry(env);
      const handler = routes[routeKey];

      if (handler) {
        return await handler(request, env);
      }

      return handleNotFound();
    } catch (error) {
      return createErrorResponse(error);
    }
  },
};
