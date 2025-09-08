// src/utils/category-detector.js
/**
 * Category Detection Utility
 * 
 * Uses JSON-based pattern matching to categorize images based on filename,
 * context, alt text, and position information.
 */

import categoryPatterns from '../data/category-patterns.json?raw';

// Cache for parsed patterns
let parsedPatterns = null;

/**
 * Load and parse category patterns from JSON
 * @returns {Object} Parsed category patterns
 */
function loadCategoryPatterns() {
  if (parsedPatterns) {
    return parsedPatterns;
  }
  
  try {
    parsedPatterns = JSON.parse(categoryPatterns);
    return parsedPatterns;
  } catch (error) {
    console.error('Failed to parse category patterns:', error);
    return null;
  }
}

/**
 * Detect image category based on patterns
 * @param {string} imageUrl - URL of the image
 * @param {string} context - Context information about the image
 * @param {string} altText - Alt text of the image
 * @param {string} position - Position information (above-fold, below-fold, etc.)
 * @param {number} width - Image width (optional)
 * @param {number} height - Image height (optional)
 * @returns {Object} Category detection result with confidence
 */
export function detectCategory(imageUrl, context = '', altText = '', position = '', width = 0, height = 0) {
  const patterns = loadCategoryPatterns();
  if (!patterns || !patterns.categories) {
    return {
      category: 'other',
      confidence: 'none',
      score: 0,
      source: 'fallback'
    };
  }

  const filename = imageUrl.toLowerCase();
  const contextLower = context.toLowerCase();
  const altLower = altText.toLowerCase();
  const positionLower = position.toLowerCase();

  let bestMatch = {
    category: 'other',
    confidence: 'none',
    score: 0,
    source: 'pattern-matching'
  };

  // Score each category
  Object.entries(patterns.categories).forEach(([categoryName, categoryData]) => {
    const score = calculateCategoryScore(
      categoryName,
      categoryData,
      filename,
      contextLower,
      altLower,
      positionLower,
      width,
      height
    );

    if (score > bestMatch.score) {
      bestMatch = {
        category: categoryName,
        confidence: getConfidenceLevel(score, categoryData.confidence),
        score: score,
        source: 'pattern-matching'
      };
    }
  });

  return bestMatch;
}

/**
 * Calculate score for a specific category
 * @param {string} categoryName - Name of the category
 * @param {Object} categoryData - Category pattern data
 * @param {string} filename - Image filename (lowercase)
 * @param {string} context - Context information (lowercase)
 * @param {string} altText - Alt text (lowercase)
 * @param {string} position - Position information (lowercase)
 * @param {number} width - Image width (optional)
 * @param {number} height - Image height (optional)
 * @returns {number} Score for this category
 */
function calculateCategoryScore(categoryName, categoryData, filename, context, altText, position, width = 0, height = 0) {
  let score = 0;
  const keywords = categoryData.keywords;

  // 1. Filename matching (high weight)
  if (keywords.filename) {
    const filenameMatches = keywords.filename.filter(keyword => 
      filename.includes(keyword.toLowerCase())
    ).length;
    score += filenameMatches * 3;
  }

  // 2. Enhanced context matching (high weight)
  if (keywords.context) {
    const contextMatches = keywords.context.filter(keyword => 
      context.includes(keyword.toLowerCase())
    ).length;
    score += contextMatches * 2.5;
  }

  // 3. Enhanced alt text matching (high weight for people detection)
  if (keywords.alt) {
    const altMatches = keywords.alt.filter(keyword => 
      altText.includes(keyword.toLowerCase())
    ).length;
    score += altMatches * 2;
  }

  // 4. Position matching (medium weight)
  if (keywords.position) {
    const positionMatches = keywords.position.filter(keyword => 
      position.includes(keyword.toLowerCase())
    ).length;
    score += positionMatches * 2;
  }

  // 5. Dimension analysis (new factor)
  if (width > 0 && height > 0) {
    const dimensionScore = analyzeImageDimensions(categoryName, width, height);
    score += dimensionScore * 1.5;
  }

  // 6. Advanced people detection (high weight)
  if (categoryName === 'team-member') {
    const peopleScore = detectPeopleInAltText(altText) + detectPeopleInContext(context);
    score += peopleScore * 4; // Very high weight for people detection
  }

  // 7. Enhanced decorative detection (stricter criteria)
  if (categoryName === 'decorative-background') {
    const decorativeScore = analyzeDecorativeIndicators(filename, context, altText, position);
    score += decorativeScore;
  }

  // 8. Content analysis for articles
  if (categoryName === 'article-content') {
    const contentScore = analyzeContentIndicators(context, altText);
    score += contentScore * 2;
  }

  return score;
}

/**
 * Analyze image dimensions for categorization hints
 * @param {string} categoryName - Category being analyzed
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} Dimension-based score
 */
function analyzeImageDimensions(categoryName, width, height) {
  const aspectRatio = width / height;
  const isSquare = Math.abs(aspectRatio - 1) < 0.1;
  const isPortrait = aspectRatio < 0.8;
  const isLandscape = aspectRatio > 1.2;
  const isSmall = width < 200 || height < 200;
  const isLarge = width > 800 || height > 800;

  switch (categoryName) {
    case 'team-member':
      // Headshots are often square or portrait
      if (isSquare || isPortrait) return 2;
      if (isLandscape) return -1;
      break;
    
    case 'hero-banner':
      // Hero images are often large and landscape
      if (isLarge && isLandscape) return 3;
      if (isSmall) return -2;
      break;
    
    case 'navigation-ui':
      // UI elements are often small and square
      if (isSmall && isSquare) return 2;
      if (isLarge) return -1;
      break;
    
    case 'logo-brand':
      // Logos are often square or small
      if (isSquare || isSmall) return 2;
      break;
    
    case 'decorative-background':
      // Background images are often large
      if (isLarge) return 1;
      break;
  }
  
  return 0;
}

/**
 * Detect people in alt text using advanced patterns
 * @param {string} altText - Alt text to analyze
 * @returns {number} People detection score
 */
function detectPeopleInAltText(altText) {
  if (!altText) return 0;
  
  let score = 0;
  const text = altText.toLowerCase();
  
  // People name patterns
  const namePatterns = [
    /^[a-z]+ [a-z]+$/,  // "john smith"
    /^(mr|ms|dr|prof)\. [a-z]+/,  // "mr. johnson"
    /[a-z]+, (ceo|cto|manager|director|founder|president)/,  // "smith, ceo"
    /(ceo|cto|manager|director|founder|president) [a-z]+/  // "ceo john smith"
  ];
  
  // Check for name patterns
  if (namePatterns.some(pattern => pattern.test(text))) {
    score += 3;
  }
  
  // Professional titles and roles
  const professionalTerms = [
    'ceo', 'cto', 'manager', 'director', 'founder', 'president',
    'executive', 'leader', 'head', 'chief', 'vice president',
    'award', 'winner', 'partner', 'announcement'
  ];
  
  const professionalMatches = professionalTerms.filter(term => text.includes(term)).length;
  score += professionalMatches * 1.5;
  
  // Descriptive terms for people
  const peopleDescriptions = [
    'smiling', 'portrait', 'headshot', 'executive', 'professional',
    'business', 'suit', 'smile', 'looking', 'standing', 'sitting'
  ];
  
  const descriptionMatches = peopleDescriptions.filter(term => text.includes(term)).length;
  score += descriptionMatches * 1;
  
  return Math.min(score, 5); // Cap at 5 points
}

/**
 * Detect people in context using business/team indicators
 * @param {string} context - Context to analyze
 * @returns {number} People detection score
 */
function detectPeopleInContext(context) {
  if (!context) return 0;
  
  let score = 0;
  const text = context.toLowerCase();
  
  // Team and business context
  const teamContext = [
    'award', 'winner', 'announcement', 'partner', 'executive',
    'leadership', 'team', 'staff', 'director', 'manager',
    'ecosystem', 'global', 'partner awards', 'winners',
    'executive moves', 'hiring', 'notable', 'moves'
  ];
  
  const contextMatches = teamContext.filter(term => text.includes(term)).length;
  score += contextMatches * 1.5;
  
  // Article context that often contains people
  const articleContext = [
    'news', 'story', 'article', 'announcement', 'press',
    'release', 'awards', 'winners', 'executives', 'leaders'
  ];
  
  const articleMatches = articleContext.filter(term => text.includes(term)).length;
  score += articleMatches * 1;
  
  return Math.min(score, 4); // Cap at 4 points
}

/**
 * Analyze decorative indicators with stricter criteria
 * @param {string} filename - Image filename
 * @param {string} context - Context information
 * @param {string} altText - Alt text
 * @param {string} position - Position information
 * @returns {number} Decorative score
 */
function analyzeDecorativeIndicators(filename, context, altText, position) {
  let score = 0;
  
  // Only give points for decorative if multiple indicators are present
  const decorativeIndicators = 0;
  
  // Check for decorative filename patterns
  if (filename.includes('bg-') || filename.includes('background-') || 
      filename.includes('pattern-') || filename.includes('texture-') ||
      filename.includes('decorative-') || filename.includes('ornament-')) {
    score += 2;
  }
  
  // Check for decorative context
  if (context.includes('background') || context.includes('pattern') ||
      context.includes('texture') || context.includes('decorative')) {
    score += 1.5;
  }
  
  // Check for decorative alt text
  if (altText === 'decorative' || altText === 'background' ||
      altText === 'pattern' || altText === 'texture') {
    score += 2;
  }
  
  // Empty alt text only gets points if other decorative indicators are present
  if (altText === '' && score > 0) {
    score += 1;
  }
  
  // Exclude people indicators
  const peopleIndicators = [
    'team-', 'staff-', 'member-', 'headshot-', 'portrait-', 'person-',
    'ceo', 'cto', 'manager', 'director', 'executive', 'award', 'winner'
  ];
  
  const hasPeopleIndicators = peopleIndicators.some(indicator => 
    filename.includes(indicator) || context.includes(indicator) || altText.includes(indicator)
  );
  
  if (hasPeopleIndicators) {
    score = Math.max(0, score - 3); // Penalize if people indicators are present
  }
  
  return Math.min(score, 3); // Cap at 3 points
}

/**
 * Analyze content indicators for articles
 * @param {string} context - Context information
 * @param {string} altText - Alt text
 * @returns {number} Content analysis score
 */
function analyzeContentIndicators(context, altText) {
  let score = 0;
  
  // Article context indicators
  const articleIndicators = [
    'news', 'story', 'article', 'blog', 'post', 'editorial',
    'announcement', 'press', 'release', 'update', 'report'
  ];
  
  const contextMatches = articleIndicators.filter(indicator => 
    context.includes(indicator)
  ).length;
  score += contextMatches * 1;
  
  // Long descriptive alt text
  if (altText && altText.length > 20) {
    score += 1;
  }
  
  // Content-related alt text
  const contentAltTerms = [
    'illustration', 'diagram', 'chart', 'graph', 'infographic',
    'screenshot', 'interface', 'dashboard', 'application'
  ];
  
  const altMatches = contentAltTerms.filter(term => 
    altText.includes(term)
  ).length;
  score += altMatches * 1.5;
  
  return Math.min(score, 3); // Cap at 3 points
}

/**
 * Get confidence level based on score and category thresholds
 * @param {number} score - Calculated score
 * @param {Object} confidenceThresholds - Category confidence thresholds
 * @returns {string} Confidence level (high, medium, low, none)
 */
function getConfidenceLevel(score, confidenceThresholds) {
  if (score >= confidenceThresholds.high) {
    return 'high';
  } else if (score >= confidenceThresholds.medium) {
    return 'medium';
  } else if (score >= confidenceThresholds.low) {
    return 'low';
  } else {
    return 'none';
  }
}

/**
 * Get all available categories
 * @returns {Array} Array of category names
 */
export function getAvailableCategories() {
  const patterns = loadCategoryPatterns();
  if (!patterns || !patterns.categories) {
    return ['other'];
  }
  
  return Object.keys(patterns.categories);
}

/**
 * Get category display name
 * @param {string} categoryName - Internal category name
 * @returns {string} Display name for the category
 */
export function getCategoryDisplayName(categoryName) {
  const displayNames = {
    'hero-images': 'Hero Images',
    'team-people': 'Team & People',
    'navigation': 'Navigation',
    'articles': 'Articles',
    'products': 'Products',
    'decorative': 'Decorative',
    'social-media': 'Social Media',
    'documents': 'Documents',
    'logos': 'Logos',
    'screenshots': 'Screenshots',
    '404s': '404s',
    'other': 'Other'
  };
  
  return displayNames[categoryName] || categoryName;
}

/**
 * Get category description
 * @param {string} categoryName - Internal category name
 * @returns {string} Description of the category
 */
export function getCategoryDescription(categoryName) {
  const descriptions = {
    'hero-banner': 'Main promotional images, landing page heroes, and above-the-fold content',
    'team-member': 'Staff photos, leadership headshots, and team member images',
    'navigation-ui': 'Menu icons, navigation buttons, and interface elements',
    'article-content': 'Blog post images, editorial photos, and content illustrations',
    'product-service': 'Product photos, feature screenshots, and service images',
    'decorative-background': 'Patterns, textures, and non-essential visual elements',
    'social-sharing': 'Open Graph images, social media assets, and sharing previews',
    'document-pdf': 'Document thumbnails, PDF previews, and file icons',
    'logo-brand': 'Company logos, brand marks, and identity elements',
    'screenshot-demo': 'App screenshots, software demos, and interface previews',
    'other': 'Images that don\'t fit into other categories'
  };
  
  return descriptions[categoryName] || 'Unknown category';
}

/**
 * Check if a category is high-priority for performance optimization
 * @param {string} categoryName - Category name
 * @returns {boolean} Whether this category is high-priority
 */
export function isHighPriorityCategory(categoryName) {
  const highPriorityCategories = [
    'hero-banner',
    'navigation-ui',
    'logo-brand'
  ];
  
  return highPriorityCategories.includes(categoryName);
}

/**
 * Check if a category is accessibility-critical
 * @param {string} categoryName - Category name
 * @returns {boolean} Whether this category is accessibility-critical
 */
export function isAccessibilityCritical(categoryName) {
  const accessibilityCriticalCategories = [
    'team-member',
    'navigation-ui',
    'product-service',
    'article-content'
  ];
  
  return accessibilityCriticalCategories.includes(categoryName);
}

/**
 * Get category icon (for future UI enhancements)
 * @param {string} categoryName - Category name
 * @returns {string} Icon name or class
 */
export function getCategoryIcon(categoryName) {
  const icons = {
    'hero-banner': 'photo',
    'team-member': 'photo',
    'navigation-ui': 'grid',
    'article-content': 'photo',
    'product-service': 'photo',
    'decorative-background': 'photo',
    'social-sharing': 'external-link',
    'document-pdf': 'pdf',
    'logo-brand': 'link',
    'screenshot-demo': 'video',
    'other': 'photo'
  };
  
  return icons[categoryName] || 'photo';
}
