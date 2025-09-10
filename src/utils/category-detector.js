// src/utils/category-detector.js

import categoryPatterns from '../data/category-patterns.json' with { type: 'json' };

let parsedPatterns = null;

function loadCategoryPatterns() {
  if (parsedPatterns) {
    return parsedPatterns;
  }

  try {
    if (typeof categoryPatterns === 'object' && categoryPatterns !== null) {
      parsedPatterns = categoryPatterns;
    } else {
      parsedPatterns = JSON.parse(categoryPatterns);
    }

    return parsedPatterns;
  } catch (error) {
    return null;
  }
}

function getConfidenceLevel(score, confidenceThresholds) {
  if (score >= confidenceThresholds.high) {
    return 'high';
  } if (score >= confidenceThresholds.medium) {
    return 'medium';
  } if (score >= confidenceThresholds.low) {
    return 'low';
  }
  return 'none';
}

function calculateNegativePenalty(negativeIndicators, filename, context, altText) {
  let penalty = 0;
  const filenameLower = filename.toLowerCase();
  const contextLower = context.toLowerCase();
  const altLower = altText.toLowerCase();

  if (negativeIndicators.filename) {
    const filenamePenalty = negativeIndicators.filename
      .filter((indicator) => filenameLower.includes(indicator.toLowerCase())).length;
    penalty += filenamePenalty * 2;
  }

  if (negativeIndicators.context) {
    const contextPenalty = negativeIndicators.context
      .filter((indicator) => contextLower.includes(indicator.toLowerCase())).length;
    penalty += contextPenalty * 1.5;
  }

  if (negativeIndicators.alt) {
    const altPenalty = negativeIndicators.alt
      .filter((indicator) => altLower.includes(indicator.toLowerCase())).length;
    penalty += altPenalty * 1.5;
  }

  return penalty;
}

function analyzeImageDimensionsWithConstraints(dimensions, aspectRatio, pixels) {
  let score = 0;

  if (dimensions.minAspectRatio && aspectRatio < dimensions.minAspectRatio) {
    score -= 2;
  }
  if (dimensions.maxAspectRatio && aspectRatio > dimensions.maxAspectRatio) {
    score -= 2;
  }

  if (dimensions.minPixels && pixels < dimensions.minPixels) {
    score -= 2;
  }
  if (dimensions.maxPixels && pixels > dimensions.maxPixels) {
    score -= 2;
  }

  if ((!dimensions.minAspectRatio || aspectRatio >= dimensions.minAspectRatio)
      && (!dimensions.maxAspectRatio || aspectRatio <= dimensions.maxAspectRatio)
      && (!dimensions.minPixels || pixels >= dimensions.minPixels)
      && (!dimensions.maxPixels || pixels <= dimensions.maxPixels)) {
    score += 2;
  }

  return score;
}

function analyzeImageDimensionsLegacy(categoryName, width, height) {
  const aspectRatio = width / height;
  const isSquare = Math.abs(aspectRatio - 1) < 0.1;
  const isPortrait = aspectRatio < 0.8;
  const isLandscape = aspectRatio > 1.2;

  switch (categoryName) {
    case 'logos':
      if (isSquare || isLandscape) return 2;
      if (isPortrait) return -1;
      break;
    case 'screenshots':
      if (isLandscape) return 2;
      if (isSquare) return 1;
      if (isPortrait) return -2;
      break;
    case 'people-photos':
      if (isPortrait || isSquare) return 2;
      if (isLandscape) return 0;
      break;
    case 'products':
      if (isSquare || isLandscape) return 1;
      if (isPortrait) return 0;
      break;
    default:
      return 0;
  }

  return 0;
}

function analyzeImageDimensions(categoryName, categoryData, width, height) {
  const aspectRatio = width / height;
  const pixels = width * height;

  if (categoryData.dimensions) {
    return analyzeImageDimensionsWithConstraints(categoryData.dimensions, aspectRatio, pixels);
  }

  return analyzeImageDimensionsLegacy(categoryName, width, height);
}

function detectPeopleInAltText(altText) {
  if (!altText) return 0;

  let score = 0;
  const text = altText.toLowerCase();

  const namePatterns = [
    /^[a-z]+ [a-z]+$/,
    /^(mr|ms|dr|prof)\. [a-z]+/,
    /[a-z]+, (ceo|cto|manager|director|founder|president)/,
    /(ceo|cto|manager|director|founder|president) [a-z]+/,
  ];

  if (namePatterns.some((pattern) => pattern.test(text))) {
    score += 3;
  }

  const professionalTerms = [
    'ceo', 'cto', 'manager', 'director', 'founder', 'president',
    'team', 'staff', 'employee', 'worker', 'professional',
  ];

  if (professionalTerms.some((term) => text.includes(term))) {
    score += 2;
  }

  const peopleIndicators = [
    'person', 'people', 'man', 'woman', 'child', 'baby',
    'portrait', 'headshot', 'photo', 'picture', 'image',
  ];

  if (peopleIndicators.some((indicator) => text.includes(indicator))) {
    score += 1;
  }

  return Math.min(score, 5);
}

function detectPeopleInContext(context) {
  if (!context) return 0;

  let score = 0;
  const text = context.toLowerCase();

  const teamIndicators = [
    'team', 'staff', 'employees', 'workers', 'professionals',
    'leadership', 'management', 'founders', 'co-founders',
  ];

  if (teamIndicators.some((indicator) => text.includes(indicator))) {
    score += 3;
  }

  const peopleIndicators = [
    'people', 'person', 'individual', 'member', 'colleague',
    'partner', 'associate', 'representative',
  ];

  if (peopleIndicators.some((indicator) => text.includes(indicator))) {
    score += 2;
  }

  const professionalContext = [
    'about us', 'our team', 'meet the team', 'leadership team',
    'company', 'organization', 'business', 'corporate',
  ];

  if (professionalContext.some((contextItem) => text.includes(contextItem))) {
    score += 2;
  }

  return Math.min(score, 5);
}

function analyzeTechnicalContent(context, altText) {
  if (!context && !altText) return 0;

  let score = 0;
  const text = `${context || ''} ${altText || ''}`.toLowerCase();

  const technicalTerms = [
    'screenshot', 'interface', 'ui', 'ux', 'design', 'mockup',
    'wireframe', 'prototype', 'demo', 'preview', 'example',
    'application', 'app', 'software', 'program', 'system',
    'dashboard', 'admin', 'panel', 'control', 'settings',
    'configuration', 'setup', 'installation', 'deployment',
  ];

  if (technicalTerms.some((term) => text.includes(term))) {
    score += 3;
  }

  const developmentTerms = [
    'development', 'coding', 'programming', 'development',
    'frontend', 'backend', 'api', 'database', 'server',
    'framework', 'library', 'tool', 'utility',
  ];

  if (developmentTerms.some((term) => text.includes(term))) {
    score += 2;
  }

  return Math.min(score, 5);
}

function analyzeContextClustering(categoryName, context, altText) {
  if (!context && !altText) return 0;

  let score = 0;
  const text = `${context || ''} ${altText || ''}`.toLowerCase();

  switch (categoryName) {
    case 'screenshots':
      if (text.includes('screenshot') || text.includes('interface')) {
        score += 2;
      }
      break;

    case 'logos':
      if (text.includes('logo') || text.includes('brand')) {
        score += 2;
      }
      break;

    case 'people-photos':
      if (text.includes('team') || text.includes('staff')) {
        score += 2;
      }
      break;

    case 'products':
      if (text.includes('product') || text.includes('item')) {
        score += 2;
      }
      break;

    default:
      break;
  }

  return Math.min(score, 3);
}

function calculateCategoryScore(
  categoryName,
  categoryData,
  filename,
  context,
  altText,
  position,
  width = 0,
  height = 0,
) {
  let score = 0;
  const { keywords } = categoryData;

  if (keywords.filename) {
    const filenameMatches = keywords.filename
      .filter((keyword) => filename.includes(keyword.toLowerCase())).length;
    score += filenameMatches * 3;
  }

  if (keywords.context) {
    const contextMatches = keywords.context
      .filter((keyword) => context.includes(keyword.toLowerCase())).length;
    score += contextMatches * 2.5;
  }

  if (keywords.alt) {
    const altMatches = keywords.alt
      .filter((keyword) => altText.includes(keyword.toLowerCase())).length;
    score += altMatches * 2;
  }

  if (keywords.position) {
    const positionMatches = keywords.position
      .filter((keyword) => position.includes(keyword.toLowerCase())).length;
    score += positionMatches * 2;
  }

  if (categoryData.negativeIndicators) {
    const negativePenalty = calculateNegativePenalty(
      categoryData.negativeIndicators,
      filename,
      context,
      altText,
    );
    score -= negativePenalty;
  }

  if (width > 0 && height > 0) {
    const dimensionScore = analyzeImageDimensions(categoryName, categoryData, width, height);
    score += dimensionScore * 1.5;
  }

  if (categoryName === 'people-photos') {
    const peopleScore = detectPeopleInAltText(altText) + detectPeopleInContext(context);
    score += peopleScore * 2;
  }

  if (categoryName === 'screenshots') {
    const technicalScore = analyzeTechnicalContent(context, altText);
    score += technicalScore * 3;
  }

  const contextClusterScore = analyzeContextClustering(categoryName, context, altText);
  score += contextClusterScore * 2;

  return Math.max(0, score);
}

export function detectCategory(
  imageUrl,
  context = '',
  altText = '',
  position = '',
  width = 0,
  height = 0,
) {
  const patterns = loadCategoryPatterns();
  if (!patterns || !patterns.categories) {
    return {
      category: 'other',
      confidence: 'none',
      score: 0,
      source: 'fallback',
    };
  }

  const filename = imageUrl.toLowerCase();
  const contextLower = context.toLowerCase();
  const altLower = altText.toLowerCase();
  const positionLower = position.toLowerCase();

  const detectionOrder = ['screenshots', 'logos', 'people-photos', 'products', '404-media'];

  for (const categoryName of detectionOrder) {
    const categoryData = patterns.categories[categoryName];
    if (!categoryData) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const score = calculateCategoryScore(
      categoryName,
      categoryData,
      filename,
      contextLower,
      altLower,
      positionLower,
      width,
      height,
    );

    const confidence = getConfidenceLevel(score, categoryData.confidence);

    if (confidence === 'high') {
      return {
        category: categoryName,
        confidence,
        score,
        source: 'hierarchical-detection',
      };
    }

    if (confidence === 'medium' && score > 0) {
      return {
        category: categoryName,
        confidence,
        score,
        source: 'hierarchical-detection',
      };
    }
  }

  return {
    category: 'other',
    confidence: 'low',
    score: 0,
    source: 'fallback',
  };
}

export function getAvailableCategories() {
  const patterns = loadCategoryPatterns();
  if (!patterns || !patterns.categories) {
    return ['other'];
  }

  return Object.keys(patterns.categories);
}

export function getCategoryDisplayName(categoryName) {
  const displayNames = {
    screenshots: 'Screenshots',
    logos: 'Logos',
    'people-photos': 'People',
    products: 'Products',
    '404-media': '404 Errors',
    other: 'Other',
  };

  return displayNames[categoryName] || categoryName;
}

export function getCategoryDescription(categoryName) {
  const descriptions = {
    screenshots: 'App interfaces, software demos, and UI previews',
    logos: 'Brand logos, company symbols, and identity elements',
    'people-photos': 'Team photos, headshots, and professional portraits',
    products: 'Product photos, catalog images, and merchandise',
    '404-media': 'Images that return 404 errors or other HTTP errors',
    other: 'Images that don\'t fit into other categories',
  };

  return descriptions[categoryName] || 'Unknown category';
}

export function isHighPriorityCategory(categoryName) {
  const highPriorityCategories = [
    'logos',
    'screenshots',
  ];

  return highPriorityCategories.includes(categoryName);
}

export function isAccessibilityCritical(categoryName) {
  const accessibilityCriticalCategories = [
    'people-photos',
    'logos',
    'products',
    'screenshots',
  ];

  return accessibilityCriticalCategories.includes(categoryName);
}

export function getCategoryIcon(categoryName) {
  const icons = {
    screenshots: 'video',
    logos: 'link',
    'people-photos': 'photo',
    products: 'photo',
    '404-media': 'close',
    other: 'photo',
  };

  return icons[categoryName] || 'photo';
}
