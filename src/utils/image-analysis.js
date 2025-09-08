// src/utils/image-analysis.js
/**
 * Image Analysis Utilities
 * 
 * This module provides image analysis capabilities using exifr for EXIF data extraction.
 * Focused on lightweight metadata extraction without heavy ML dependencies.
 * Now includes JSON-based image categorization with confidence scoring.
 */

import { detectCategory } from './category-detector.js';

export const ANALYSIS_CONFIG = {
  enabled: true,
  extractEXIF: true,
  extractDimensions: true,
  categorizeFromFilename: true,
  analyzeUsage: true,
};

const analysisCache = new Map();

/**
 * Main analysis function - orchestrates all analysis steps
 * @param {string} imageUrl - URL of the image to analyze
 * @param {Object} existingAnalysis - Previous analysis results (for change detection)
 * @param {string} context - Context information about the image
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeImage(imageUrl, existingAnalysis = null, context = '') {
  if (!ANALYSIS_CONFIG.enabled) {
    return getBasicAnalysis(imageUrl);
  }

  try {
    if (existingAnalysis && !(await hasContentChanged(imageUrl, existingAnalysis))) {
      return existingAnalysis;
    }
    
    const analysis = await runAnalysisPipeline(imageUrl, context);
    
    const contentHash = await getImageContentHash(imageUrl);
    analysisCache.set(contentHash, analysis);
    
    return analysis;
  } catch (error) {
    console.error(`Image analysis failed for ${imageUrl}:`, error);
    return getBasicAnalysis(imageUrl);
  }
}

/**
 * Basic analysis without external libraries
 * @param {string} imageUrl - URL of the image
 * @returns {Object} Basic analysis results
 */
function getBasicAnalysis(imageUrl) {
  return {
    orientation: 'unknown',
    category: 'other',
    width: 0,
    height: 0,
    confidence: 'none',
    source: 'basic'
  };
}

/**
 * Run the complete analysis pipeline
 * @param {string} imageUrl - URL of the image
 * @param {string} context - Context information about the image
 * @returns {Promise<Object>} Complete analysis results
 */
async function runAnalysisPipeline(imageUrl, context = '') {
  const analysis = {
    source: 'analysis',
    confidence: 'low'
  };

  if (ANALYSIS_CONFIG.extractDimensions) {
    const dimensions = await getImageDimensions(imageUrl);
    analysis.width = dimensions.width;
    analysis.height = dimensions.height;
    analysis.orientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait';
  }

  if (ANALYSIS_CONFIG.categorizeFromFilename) {
    const categoryResult = detectCategory(imageUrl, context, '', '', analysis.width, analysis.height);
    analysis.category = categoryResult.category;
    analysis.categoryConfidence = categoryResult.confidence;
    analysis.categoryScore = categoryResult.score;
    analysis.categorySource = categoryResult.source;
    
    if (categoryResult.confidence === 'high') {
      analysis.confidence = 'high';
    } else if (categoryResult.confidence === 'medium' && analysis.confidence === 'low') {
      analysis.confidence = 'medium';
    }
  }

  if (ANALYSIS_CONFIG.extractEXIF) {
    const exifData = await extractEXIFData(imageUrl);
    if (exifData) {
      if (exifData.error) {
        analysis.exifError = exifData;
      } else {
        analysis.exifCamera = exifData.camera;
        analysis.exifDate = exifData.date;
        analysis.exifOrientation = exifData.orientation;
        if (exifData.camera || exifData.date) {
          analysis.confidence = 'high';
        }
      }
    }
  }

  return analysis;
}

/**
 * Extract EXIF data from image
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Object|null>} EXIF data, error details, or null
 */
async function extractEXIFData(imageUrl) {
  try {
    // Dynamic import to avoid loading if not needed
    const exifr = await import('exifr');
    
    // Fetch the image as a blob to extract EXIF data
    const response = await fetch(imageUrl);
    if (!response.ok) {
      // Capture HTTP error details
      return {
        error: true,
        errorType: response.status === 404 ? '404' : 'http_error',
        errorMessage: `HTTP ${response.status}`,
        statusCode: response.status
      };
    }
    
    const blob = await response.blob();
    const exifData = await exifr.parse(blob, {
      pick: ['Make', 'Model', 'DateTime', 'Orientation']
    });
    
    if (!exifData) {
      return null;
    }
    
    let camera = null;
    const make = exifData.Make;
    const model = exifData.Model;
    
    if (make && model && make !== 'undefined' && model !== 'undefined') {
      camera = `${make} ${model}`.trim();
    } else if (make && make !== 'undefined') {
      camera = make.trim();
    } else if (model && model !== 'undefined') {
      camera = model.trim();
    }
    
    return {
      camera: camera || null,
      date: exifData.DateTime || null,
      orientation: exifData.Orientation || null
    };
  } catch (error) {
    if (error.message.includes('Failed to fetch dynamically imported module')) {
      console.warn('EXIF library failed to load - this may be a Vite optimization issue');
      return {
        error: true,
        errorType: 'library',
        errorMessage: 'EXIF library failed to load',
        statusCode: null
      };
    } else if (error.message.includes('Failed to fetch image')) {
      console.warn('Failed to fetch image for EXIF extraction:', imageUrl);
      return {
        error: true,
        errorType: '404',
        errorMessage: 'Image not found',
        statusCode: 404
      };
    } else if (error.message.includes('CORS')) {
      return {
        error: true,
        errorType: 'cors',
        errorMessage: 'CORS blocked',
        statusCode: null
      };
    } else {
      console.warn('EXIF extraction failed:', error.message);
      return {
        error: true,
        errorType: 'unknown',
        errorMessage: error.message,
        statusCode: null
      };
    }
  }
}

/**
 * Get image dimensions
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Object>} Image dimensions
 */
async function getImageDimensions(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      resolve({
        width: this.naturalWidth,
        height: this.naturalHeight
      });
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = imageUrl;
  });
}

/**
 * Legacy categorization function - now deprecated in favor of JSON-based detection
 * @param {string} imageUrl - URL of the image
 * @param {string} context - Context information about the image
 * @returns {string} Category
 * @deprecated Use detectCategory from category-detector.js instead
 */
function categorizeFromFilename(imageUrl, context = '') {
  const categoryResult = detectCategory(imageUrl, context, '', '');
  return categoryResult.category;
}

/**
 * Check if image content has changed
 * @param {string} imageUrl - URL of the image
 * @param {Object} existingAnalysis - Previous analysis
 * @returns {Promise<boolean>} Whether content changed
 */
async function hasContentChanged(imageUrl, existingAnalysis) {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const currentETag = response.headers.get('ETag');
    const currentLastModified = response.headers.get('Last-Modified');
    
    return currentETag !== existingAnalysis.etag || 
           currentLastModified !== existingAnalysis.lastModified;
  } catch (error) {
    return true; // Assume changed if we can't check
  }
}

/**
 * Generate content hash for caching
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} Content hash
 */
async function getImageContentHash(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    return imageUrl; // Fallback to URL
  }
}

/**
 * Update analysis configuration
 * @param {Object} config - New configuration
 */
export function updateAnalysisConfig(config) {
  Object.assign(ANALYSIS_CONFIG, config);
}

/**
 * Get current analysis configuration
 * @returns {Object} Current configuration
 */
export function getAnalysisConfig() {
  return { ...ANALYSIS_CONFIG };
}

/**
 * Clear analysis cache
 */
export function clearAnalysisCache() {
  analysisCache.clear();
}

if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}