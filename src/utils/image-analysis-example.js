// src/utils/image-analysis-example.js
/**
 * Example usage of image analysis in Media Library
 * 
 * This file shows how to enable and configure image analysis
 * in your media library application.
 */

import { SitemapParser } from './sitemap-parser.js';

// Example 1: Basic usage with image analysis disabled (default)
const parser1 = new SitemapParser();
// Image analysis is disabled by default

// Example 2: Enable basic image analysis
const parser2 = new SitemapParser({
  enableImageAnalysis: true,
  analysisConfig: {
    extractEXIF: true,
    extractDimensions: true,
    categorizeFromFilename: true,
    detectFaces: false,        // Disable expensive face detection
    classifyImages: false,     // Disable expensive ML classification
    analyzeColors: false       // Disable expensive color analysis
  }
});

// Example 3: Enable full analysis with all features
const parser3 = new SitemapParser({
  enableImageAnalysis: true,
  analysisConfig: {
    extractEXIF: true,
    extractDimensions: true,
    categorizeFromFilename: true,
    detectFaces: true,         // Enable face detection
    classifyImages: true,      // Enable ML classification
    analyzeColors: true        // Enable color analysis
  }
});

// Example 4: Runtime configuration changes
const parser4 = new SitemapParser();

// Start with basic analysis
parser4.setImageAnalysis(true, {
  extractEXIF: true,
  extractDimensions: true,
  categorizeFromFilename: true
});

// Later, enable more features
parser4.setImageAnalysis(true, {
  extractEXIF: true,
  extractDimensions: true,
  categorizeFromFilename: true,
  detectFaces: true,
  classifyImages: true
});

// Disable analysis completely
parser4.setImageAnalysis(false);

// Example 5: Check current configuration
const config = parser4.getImageAnalysisConfig();
console.log('Current analysis config:', config);

/**
 * Usage in your Media Library component:
 * 
 * // In your media-library.js
 * constructor() {
 *   super();
 *   this.sitemapParser = new SitemapParser({
 *     enableImageAnalysis: true,
 *     analysisConfig: {
 *       extractEXIF: true,
 *       extractDimensions: true,
 *       categorizeFromFilename: true,
 *       detectFaces: false,  // Start with basic features
 *       classifyImages: false
 *     }
 *   });
 * }
 * 
 * // Add UI controls to toggle analysis
 * toggleImageAnalysis(enabled) {
 *   this.sitemapParser.setImageAnalysis(enabled, {
 *     extractEXIF: true,
 *     extractDimensions: true,
 *     categorizeFromFilename: true,
 *     detectFaces: enabled,  // Only enable expensive features when requested
 *     classifyImages: enabled
 *   });
 * }
 */

export { parser1, parser2, parser3, parser4 };
