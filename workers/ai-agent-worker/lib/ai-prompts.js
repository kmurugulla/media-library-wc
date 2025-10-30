// workers/ai-agent-worker/ai-prompts.js
// AI Prompts and Guidelines for Production-Grade AI Features

// ============================================================================
// UNIFIED SYSTEM PROMPT - Multi-expert AI for chat queries
// ============================================================================

/**
 * System prompt for AI Agent chat queries (broad discovery)
 * Used in /api/ai/query endpoint for natural language queries
 */
export const UNIFIED_SYSTEM_PROMPT = `You are a function-calling AI for a media library. Call the appropriate function for each query.

TOOLS:
- getImagesWithoutAlt: Images missing alt text (alt IS NULL) - accessibility issues
- getDecorativeImages: Decorative images (alt="") - intentional per WCAG
- getLargeImages: Oversized images (>1000px width)
- getLazyLoadedImages: Images with loading="lazy"
- getPageImages: All images on a specific page URL
- getSeoIssues: Comprehensive audit (missing alt, oversized, no lazy loading)

IMPORTANT: 
- alt IS NULL = missing (bad)
- alt="" = decorative (intentional, OK)
- Call ONE function per query
- For general audits, use getSeoIssues`;

// ============================================================================
// SUGGESTED QUESTIONS - Organized by category for chat panel
// ============================================================================

export const SUGGESTED_QUESTIONS = {
  seo: {
    name: 'SEO & Performance',
    questions: [
      'Which images are missing alt text?',
      'Find oversized images slowing down page load',
      'Show images without lazy loading',
      'Images on the homepage that need optimization',
    ],
  },

  accessibility: {
    name: 'Accessibility & Compliance',
    questions: [
      'Accessibility audit: images without alt text',
      'Find images that should be marked decorative',
      'Images with accessibility issues',
      'WCAG compliance check for images',
    ],
  },

  developer: {
    name: 'Technical & Implementation',
    questions: [
      'Images without srcset for responsive design',
      'Find images missing lazy loading attribute',
      'Performance bottlenecks from large images',
      'Images that should use modern formats',
    ],
  },

  content: {
    name: 'Content Quality',
    questions: [
      'Images with poor or missing descriptions',
      'Pages that need better imagery',
      'Images that need better context',
      'Content quality issues with images',
    ],
  },

  admin: {
    name: 'Site Overview',
    questions: [
      'Overall image health report',
      'Most common issues across the site',
      'Pages with the most image problems',
      'Quick wins for site improvement',
    ],
  },
};

// ============================================================================
// SUGGESTED ACTIONS - Actionable recommendations based on findings
// ============================================================================

const ACTIONS = {
  getImagesWithoutAlt: [
    { label: 'Add descriptive alt text (WCAG 1.1.1)', priority: 'high', wcag: '1.1.1' },
    { label: 'Mark decorative images with alt=""', priority: 'medium', wcag: '1.1.1' },
    { label: 'Prioritize high-traffic pages first', priority: 'medium', wcag: null },
  ],
  getLargeImages: [
    { label: 'Compress images to <100KB', priority: 'high', wcag: null },
    { label: 'Use WebP/AVIF format', priority: 'high', wcag: null },
    { label: 'Add lazy loading attribute', priority: 'medium', wcag: null },
    { label: 'Implement responsive images (srcset)', priority: 'medium', wcag: null },
  ],
  getLazyLoadedImages: [
    { label: 'Good! Lazy loading is enabled', priority: 'low', wcag: null },
    { label: 'Check above-the-fold images', priority: 'medium', wcag: null },
  ],
  getSeoIssues: [
    { label: 'Fix missing alt text', priority: 'high', wcag: '1.1.1' },
    { label: 'Compress oversized images', priority: 'high', wcag: null },
    { label: 'Add lazy loading', priority: 'medium', wcag: null },
  ],
};

export const generateSuggestedActions = (toolName) => ACTIONS[toolName] || [];

// ============================================================================
// ALT TEXT GENERATION PROMPTS - For per-image analysis
// ============================================================================

/**
 * WCAG 1.1.1 Guidelines for Alt Text
 */
export const WCAG_GUIDELINES = `
WCAG 1.1.1 (Level A) - Non-text Content:

1. INFORMATIVE IMAGES:
   - Describe the PURPOSE, not just visual details
   - Keep under 125 characters
   - Include context-relevant information
   - Don't start with "image of" or "picture of"

2. DECORATIVE IMAGES:
   - Use alt="" (empty string)
   - Images that don't add information
   - Purely aesthetic elements

3. FUNCTIONAL IMAGES:
   - Describe the ACTION, not the image
   - Example: "Submit form" not "Green button"

4. COMPLEX IMAGES (charts, diagrams):
   - Brief description in alt
   - Long description elsewhere (longdesc or nearby text)

5. AVOID:
   - Redundant text already in surrounding content
   - Phrases like "image of", "graphic of"
   - File names or technical jargon
`;

/**
 * SEO Best Practices for Alt Text
 */
export const SEO_GUIDELINES = `
SEO Best Practices for Alt Text:

1. KEYWORD USAGE:
   - Include 1-2 relevant keywords naturally
   - Don't keyword stuff
   - Match page topic and user intent

2. DESCRIPTIVE & SPECIFIC:
   - Be specific about what the image shows
   - Help search engines understand context
   - Improve image search visibility

3. LENGTH:
   - Optimal: 50-125 characters
   - Too short: less context for search engines
   - Too long: may be truncated by screen readers

4. NATURAL LANGUAGE:
   - Write for humans first, search engines second
   - Use complete sentences when appropriate
   - Maintain readability
`;

/**
 * Generate enhanced system prompt for alt text generation
 */
export function getAltTextSystemPrompt() {
  return `You are an expert accessibility (WCAG 2.1) and SEO specialist focused on creating optimal alt text for images.

${WCAG_GUIDELINES}

${SEO_GUIDELINES}

YOUR TASK:
Analyze the provided image context and generate alt text that:
1. Meets WCAG 1.1.1 compliance
2. Includes relevant SEO keywords naturally
3. Is concise (50-125 characters)
4. Describes PURPOSE over appearance
5. Matches the content context

RESPONSE FORMAT:
Return a JSON object with:
{
  "suggestedAlt": "The actual alt text (50-125 chars)",
  "reasoning": "Brief explanation of why this alt text is effective",
  "wcagCompliance": "1.1.1",
  "type": "informative|decorative|functional",
  "keywords": ["keyword1", "keyword2"],
  "confidence": 0.85
}

If the image appears DECORATIVE (no informational value), return:
{
  "suggestedAlt": "",
  "reasoning": "Image is decorative and should use empty alt text",
  "wcagCompliance": "1.1.1",
  "type": "decorative",
  "keywords": [],
  "confidence": 0.90
}`;
}

/**
 * Generate user prompt with context
 */
export function getAltTextUserPrompt(context, pageKeywords = []) {
  const {
    surroundingText,
    nearestHeading,
    sectionContext,
    currentAlt,
    parentElement,
  } = context;

  let prompt = 'CONTEXT:\n\n';

  if (nearestHeading) {
    prompt += `Heading: "${nearestHeading.text}" (${nearestHeading.level})\n`;
  }

  if (sectionContext) {
    prompt += `Section: ${sectionContext}\n`;
  }

  if (parentElement) {
    prompt += `Parent: <${parentElement}>\n`;
  }

  if (surroundingText) {
    prompt += `\nSurrounding Text:\n"${surroundingText}"\n`;
  }

  if (currentAlt) {
    prompt += `\nCurrent Alt Text: "${currentAlt}"\n`;
  }

  if (pageKeywords && pageKeywords.length > 0) {
    prompt += `\nPage Keywords: ${pageKeywords.join(', ')}\n`;
  }

  prompt += '\nGENERATE: Optimal alt text following WCAG and SEO guidelines. Return JSON only.';

  return prompt;
}

/**
 * Check if word is a common stop word
 */
function isCommonWord(word) {
  const stopWords = new Set([
    'this', 'that', 'these', 'those', 'they', 'them', 'their',
    'what', 'which', 'when', 'where', 'while', 'with', 'from',
    'about', 'after', 'before', 'under', 'over', 'between',
    'have', 'been', 'were', 'would', 'should', 'could',
    'more', 'most', 'some', 'such', 'into', 'through',
  ]);
  return stopWords.has(word.toLowerCase());
}

/**
 * Extract keywords from page content
 */
export function extractKeywordsFromContext(context) {
  const keywords = new Set();

  // Extract from heading
  if (context.nearestHeading?.text) {
    const headingWords = context.nearestHeading.text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !isCommonWord(word));
    headingWords.forEach((word) => keywords.add(word));
  }

  // Extract from surrounding text
  if (context.surroundingText) {
    const textWords = context.surroundingText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4 && !isCommonWord(word))
      .slice(0, 10); // Top 10 words
    textWords.forEach((word) => keywords.add(word));
  }

  return Array.from(keywords).slice(0, 5); // Max 5 keywords
}

/**
 * Calculate SEO score for alt text
 */
export function calculateSEOScore(altText, context, pageKeywords = []) {
  let score = 0;
  const factors = [];

  // Length score (50-125 chars is optimal)
  if (altText.length >= 50 && altText.length <= 125) {
    score += 30;
    factors.push({ factor: 'Optimal length (50-125 chars)', points: 30 });
  } else if (altText.length >= 30 && altText.length < 50) {
    score += 20;
    factors.push({ factor: 'Acceptable length', points: 20 });
  } else if (altText.length > 125) {
    score += 10;
    factors.push({ factor: 'Too long (>125 chars)', points: 10 });
  } else {
    score += 5;
    factors.push({ factor: 'Too short (<30 chars)', points: 5 });
  }

  // Keyword presence
  let keywordCount = 0;
  pageKeywords.forEach((keyword) => {
    if (altText.toLowerCase().includes(keyword.toLowerCase())) {
      keywordCount += 1;
    }
  });

  if (keywordCount >= 1) {
    score += 30;
    factors.push({ factor: `Contains ${keywordCount} relevant keyword(s)`, points: 30 });
  } else {
    factors.push({ factor: 'No relevant keywords', points: 0 });
  }

  // Descriptiveness (contains adjectives/nouns)
  const descriptiveWords = altText.match(/\b[a-z]{5,}\b/gi);
  if (descriptiveWords && descriptiveWords.length >= 3) {
    score += 20;
    factors.push({ factor: 'Descriptive language', points: 20 });
  } else {
    score += 10;
    factors.push({ factor: 'Could be more descriptive', points: 10 });
  }

  // Context relevance (matches heading or surrounding text)
  const contextMatch = context.nearestHeading?.text || context.surroundingText || '';
  const contextWords = contextMatch.toLowerCase().split(/\s+/);
  const altWords = altText.toLowerCase().split(/\s+/);
  const matchCount = altWords.filter((word) => contextWords.includes(word)).length;

  if (matchCount >= 2) {
    score += 20;
    factors.push({ factor: 'Matches page context', points: 20 });
  } else if (matchCount === 1) {
    score += 10;
    factors.push({ factor: 'Partially matches context', points: 10 });
  } else {
    factors.push({ factor: 'No context match', points: 0 });
  }

  let grade = 'D';
  if (score >= 80) {
    grade = 'A';
  } else if (score >= 60) {
    grade = 'B';
  } else if (score >= 40) {
    grade = 'C';
  }

  return {
    score: Math.min(score, 100),
    factors,
    grade,
  };
}

/**
 * Calculate accessibility score
 */
export function calculateA11yScore(altText, imageType = 'informative') {
  let score = 0;
  const issues = [];

  // Decorative images
  if (imageType === 'decorative') {
    if (altText === '') {
      score = 100;
    } else {
      score = 50;
      issues.push('Decorative images should have empty alt text (alt="")');
    }
    return { score, issues, wcagLevel: 'A', compliant: score === 100 };
  }

  // Informative/functional images
  if (!altText || altText.trim() === '') {
    score = 0;
    issues.push('WCAG 1.1.1 FAIL: Missing alt text for non-decorative image');
    return { score, issues, wcagLevel: 'A', compliant: false };
  }

  score += 40; // Has alt text

  // Length check
  if (altText.length <= 125) {
    score += 30;
  } else {
    issues.push('Alt text may be too long for screen readers (>125 chars)');
    score += 15;
  }

  // Avoid redundant phrases
  const badPhrases = ['image of', 'picture of', 'graphic of', 'photo of', 'icon of'];
  const hasBadPhrase = badPhrases.some((phrase) => altText.toLowerCase().includes(phrase));
  if (!hasBadPhrase) {
    score += 15;
  } else {
    issues.push('Avoid phrases like "image of" or "picture of"');
    score += 5;
  }

  // Descriptiveness
  if (altText.split(/\s+/).length >= 3) {
    score += 15;
  } else {
    issues.push('Alt text could be more descriptive');
    score += 5;
  }

  return {
    score: Math.min(score, 100),
    issues,
    wcagLevel: 'A',
    compliant: score >= 70,
  };
}

/**
 * Calculate overall impact of changing alt text
 */
export function calculateImpact(currentAlt, suggestedAlt, context, pageKeywords) {
  const currentSEO = calculateSEOScore(currentAlt || '', context, pageKeywords);
  const suggestedSEO = calculateSEOScore(suggestedAlt, context, pageKeywords);

  const currentA11y = calculateA11yScore(currentAlt || '');
  const suggestedA11y = calculateA11yScore(suggestedAlt);

  const currentOverall = Math.round((currentSEO.score + currentA11y.score) / 2);
  const suggestedOverall = Math.round((suggestedSEO.score + suggestedA11y.score) / 2);

  return {
    current: {
      seo: currentSEO.score,
      a11y: currentA11y.score,
      overall: currentOverall,
    },
    suggested: {
      seo: suggestedSEO.score,
      a11y: suggestedA11y.score,
      overall: suggestedOverall,
    },
    improvement: {
      seo: suggestedSEO.score - currentSEO.score,
      a11y: suggestedA11y.score - currentA11y.score,
      overall: suggestedOverall - currentOverall,
    },
    details: {
      seo: suggestedSEO,
      a11y: suggestedA11y,
    },
  };
}
