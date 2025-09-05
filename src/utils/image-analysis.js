// src/utils/image-analysis.js
/**
 * Image Analysis Utilities
 * 
 * This module provides image analysis capabilities using external libraries.
 * Can be easily enabled/disabled during scanning for performance control.
 */

// Configuration for analysis features
export const ANALYSIS_CONFIG = {
  enabled: true,                     // Master switch - enable by default
  extractEXIF: true,                // Extract EXIF data
  detectFaces: true,                // Face detection
  classifyImages: true,             // ML image classification
  analyzeColors: false,             // Color analysis (expensive)
  extractDimensions: true,          // Image dimensions
  categorizeFromFilename: true,     // Filename-based categorization
};

// Cache for analysis results
const analysisCache = new Map();

/**
 * Main analysis function - orchestrates all analysis steps
 * @param {string} imageUrl - URL of the image to analyze
 * @param {Object} existingAnalysis - Previous analysis results (for change detection)
 * @param {string} context - Context information about the image
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeImage(imageUrl, existingAnalysis = null, context = '') {
  console.log(`🔍 Starting image analysis for: ${imageUrl}`);
  console.log(`   Context: "${context}"`);
  console.log(`   Analysis enabled: ${ANALYSIS_CONFIG.enabled}`);
  
  if (!ANALYSIS_CONFIG.enabled) {
    console.log(`   → Analysis disabled, returning basic analysis`);
    return getBasicAnalysis(imageUrl);
  }

  try {
    // Check if content changed (if we have existing analysis)
    if (existingAnalysis && !(await hasContentChanged(imageUrl, existingAnalysis))) {
      console.log(`Reusing analysis for unchanged image: ${imageUrl}`);
      return existingAnalysis;
    }

    console.log(`Analyzing image: ${imageUrl}`);
    
    // Run analysis pipeline
    const analysis = await runAnalysisPipeline(imageUrl, context);
    
    // Cache the results
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

  // Phase 1: Fast analysis (always run if enabled)
  if (ANALYSIS_CONFIG.extractDimensions) {
    const dimensions = await getImageDimensions(imageUrl);
    analysis.width = dimensions.width;
    analysis.height = dimensions.height;
    analysis.orientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait';
  }

  if (ANALYSIS_CONFIG.categorizeFromFilename) {
    analysis.category = categorizeFromFilename(imageUrl, context);
    analysis.confidence = 'medium';
    console.log(`  → Categorization: ${imageUrl} -> ${analysis.category} (context: "${context}")`);
  }

  if (ANALYSIS_CONFIG.extractEXIF) {
    const exifData = await extractEXIFData(imageUrl);
    if (exifData) {
      analysis.exifCamera = exifData.camera;
      analysis.exifDate = exifData.date;
      analysis.exifOrientation = exifData.orientation;
    }
  }

  // Phase 2: Smart ML analysis (only when needed)
  const shouldRunML = shouldRunMLAnalysis(analysis);
  console.log(`  → Should run ML analysis: ${shouldRunML} (category: ${analysis.category}, confidence: ${analysis.confidence})`);
  
  if (shouldRunML) {
    analysis.context = context; // Add context to analysis object
    await runMLAnalysis(imageUrl, analysis);
  }

  return analysis;
}

/**
 * Determine if ML analysis should be run
 * @param {Object} currentAnalysis - Current analysis results
 * @returns {boolean} Whether to run ML analysis
 */
function shouldRunMLAnalysis(currentAnalysis) {
  // Always run ML analysis for all images to get accurate face detection
  return true;
}

/**
 * Run ML-based analysis
 * @param {string} imageUrl - URL of the image
 * @param {Object} analysis - Current analysis object to enhance
 */
async function runMLAnalysis(imageUrl, analysis) {
  try {
    console.log(`  → Running ML analysis for: ${imageUrl}`);
    console.log(`     Current category: ${analysis.category}, confidence: ${analysis.confidence}`);
    
    // Face detection (fastest ML)
    console.log(`  → Face detection config: detectFaces=${ANALYSIS_CONFIG.detectFaces}, shouldDetect=${shouldDetectFaces(imageUrl, analysis)}`);
    
    if (ANALYSIS_CONFIG.detectFaces && shouldDetectFaces(imageUrl, analysis)) {
      console.log(`  → Running face detection...`);
      const faceData = await detectFaces(imageUrl, analysis.context || '');
      console.log(`  → Face detection result:`, faceData);
      
      if (faceData.hasFaces) {
        // Only override category to headshot if we have high confidence
        if (faceData.confidence > 0.8) {
          analysis.category = 'headshot';
          analysis.hasFaces = true;
          analysis.faceCount = faceData.faceCount;
          analysis.confidence = 'high';
          console.log(`  → Face detection confirmed headshot with high confidence!`);
          return; // Face detection is reliable, skip other ML
        } else {
          // Lower confidence - keep existing category but note face detection
          analysis.hasFaces = true;
          analysis.faceCount = faceData.faceCount;
          analysis.faceConfidence = faceData.confidence;
          console.log(`  → Face detected but low confidence, keeping category: ${analysis.category}`);
        }
      }
    } else {
      console.log(`  → Skipping face detection (config: ${ANALYSIS_CONFIG.detectFaces}, should: ${shouldDetectFaces(imageUrl, analysis)})`);
    }

    // General image classification
    if (ANALYSIS_CONFIG.classifyImages) {
      const classification = await classifyImage(imageUrl);
      if (classification.confidence > 0.7) {
        analysis.category = mapToBusinessCategory(classification.category);
        analysis.confidence = 'high';
        analysis.mlCategory = classification.category;
        analysis.mlConfidence = classification.confidence;
      }
    }

    // Color analysis (expensive, optional)
    if (ANALYSIS_CONFIG.analyzeColors && shouldAnalyzeColors(imageUrl)) {
      const colorData = await analyzeColors(imageUrl);
      analysis.dominantColor = colorData.dominantColor;
      analysis.colorPalette = colorData.palette;
    }

  } catch (error) {
    console.warn(`ML analysis failed for ${imageUrl}:`, error);
  }
}

/**
 * Extract EXIF data from image
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Object|null>} EXIF data or null
 */
async function extractEXIFData(imageUrl) {
  try {
    // Dynamic import to avoid loading if not needed
    const EXIF = await import('exif-js');
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = function() {
        EXIF.getData(img, function() {
          const make = EXIF.getTag(this, 'Make');
          const model = EXIF.getTag(this, 'Model');
          const date = EXIF.getTag(this, 'DateTime');
          const orientation = EXIF.getTag(this, 'Orientation');
          
          // Only include camera info if both make and model are available
          let camera = null;
          if (make && model && make !== 'undefined' && model !== 'undefined') {
            camera = `${make} ${model}`.trim();
          } else if (make && make !== 'undefined') {
            camera = make.trim();
          } else if (model && model !== 'undefined') {
            camera = model.trim();
          }
          
          resolve({
            camera: camera || null,
            date: date || null,
            orientation: orientation || null
          });
        });
      };
      
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn('EXIF extraction failed:', error);
    return null;
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
 * Detect faces in image using TensorFlow.js COCO-SSD
 * @param {string} imageUrl - URL of the image
 * @param {string} context - Context information about the image
 * @returns {Promise<Object>} Face detection results
 */
async function detectFaces(imageUrl, context = '') {
  try {
    console.log(`    → detectFaces() called for: ${imageUrl}`);
    
    // Use TensorFlow.js COCO-SSD for object detection (includes person detection)
    const tf = await import('@tensorflow/tfjs');
    console.log(`    → TensorFlow.js imported successfully`);
    
    // Load COCO-SSD model (only once)
    if (!window.cocoSsdModel) {
      console.log('    → Loading COCO-SSD model for face detection...');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      console.log(`    → COCO-SSD package imported successfully`);
      window.cocoSsdModel = await cocoSsd.load();
      console.log(`    → COCO-SSD model loaded successfully`);
    } else {
      console.log(`    → Using cached COCO-SSD model`);
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    console.log(`    → Loading image: ${imageUrl}`);
    
    return new Promise((resolve) => {
      img.onload = async function() {
        try {
          console.log(`    → Image loaded successfully, running COCO-SSD detection...`);
          
          // Run object detection
          const predictions = await window.cocoSsdModel.detect(img);
          console.log(`    → COCO-SSD predictions:`, predictions);
          
          // Look for 'person' objects in the predictions with higher confidence threshold
          const personDetections = predictions.filter(prediction => 
            prediction.class === 'person' && prediction.score > 0.7
          );
          
          if (personDetections.length > 0) {
            console.log(`    → Detected ${personDetections.length} person(s) with confidence:`, 
                       personDetections.map(p => p.score.toFixed(2)));
            
            // Additional check: look for face-specific objects to confirm it's a real person
            const faceObjects = predictions.filter(prediction => 
              (prediction.class === 'person' || prediction.class === 'face') && prediction.score > 0.6
            );
            
            // Only consider it a headshot if we have high confidence person detection
            // AND the bounding box suggests it's a portrait (not a full body or mannequin)
            const isLikelyHeadshot = personDetections.some(detection => {
              const bbox = detection.bbox;
              const aspectRatio = bbox[2] / bbox[3]; // width / height
              const area = bbox[2] * bbox[3];
              
              // Check if it looks like a portrait (not too wide, not too small)
              return aspectRatio < 1.5 && area > 0.1; // Reasonable portrait proportions
            });
            
            if (isLikelyHeadshot) {
              console.log(`    → Confirmed as headshot based on detection analysis`);
              resolve({
                hasFaces: true,
                faceCount: personDetections.length,
                confidence: Math.max(...personDetections.map(p => p.score))
              });
            } else {
              console.log(`    → Person detected but doesn't appear to be a headshot (likely mannequin/object)`);
              resolve({ hasFaces: false, faceCount: 0, confidence: 0 });
            }
          } else {
            console.log('    → No persons detected in image');
            resolve({ hasFaces: false, faceCount: 0, confidence: 0 });
          }
        } catch (error) {
          console.warn('    → COCO-SSD detection failed:', error);
          resolve({ hasFaces: false, faceCount: 0, confidence: 0 });
        }
      };
      
      img.onerror = () => {
        console.warn('    → Failed to load image for face detection');
        resolve({ hasFaces: false, faceCount: 0, confidence: 0 });
      };
      
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn('Face detection failed:', error);
    return { hasFaces: false, faceCount: 0, confidence: 0 };
  }
}

/**
 * Classify image using TensorFlow.js
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Object>} Classification results
 */
async function classifyImage(imageUrl) {
  try {
    // Dynamic import to avoid loading if not needed
    const tf = await import('@tensorflow/tfjs');
    
    // Load MobileNet model (only once)
    if (!window.mobilenetModel) {
      window.mobilenetModel = await tf.loadLayersModel('https://tfhub.dev/google/tfjs-model/mobilenet_v2_100_224/classification/1/default/1');
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = async function() {
        try {
          const tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([224, 224]).expandDims();
          const predictions = await window.mobilenetModel.predict(tensor);
          const topPrediction = await predictions.argMax().data();
          
          resolve({
            category: getCategoryFromIndex(topPrediction[0]),
            confidence: await predictions.max().data()
          });
        } catch (error) {
          resolve({ category: 'other', confidence: 0 });
        }
      };
      
      img.onerror = () => resolve({ category: 'other', confidence: 0 });
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn('Image classification failed:', error);
    return { category: 'other', confidence: 0 };
  }
}

/**
 * Analyze colors in image
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<Object>} Color analysis results
 */
async function analyzeColors(imageUrl) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = function() {
        canvas.width = this.width;
        canvas.height = this.height;
        ctx.drawImage(this, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = getDominantColors(imageData);
        
        resolve({
          dominantColor: colors.dominant,
          palette: colors.palette
        });
      };
      
      img.onerror = () => resolve({ dominantColor: null, palette: [] });
      img.src = imageUrl;
    });
  } catch (error) {
    console.warn('Color analysis failed:', error);
    return { dominantColor: null, palette: [] };
  }
}

/**
 * Categorize image based on filename and context
 * @param {string} imageUrl - URL of the image
 * @param {string} context - Context information about the image
 * @returns {string} Category
 */
function categorizeFromFilename(imageUrl, context = '') {
  const name = imageUrl.toLowerCase();
  const contextLower = context.toLowerCase();
  const combinedText = `${name} ${contextLower}`;
  
  // Headshots and people - more conservative keywords
  if (name.includes('headshot') || name.includes('portrait') || name.includes('person') || 
      name.includes('people') || name.includes('team') || name.includes('staff') ||
      name.includes('member') || name.includes('employee') || name.includes('user') ||
      name.includes('profile') || name.includes('face') || name.includes('head') ||
      contextLower.includes('member') || contextLower.includes('team') || 
      contextLower.includes('staff') || contextLower.includes('headshot') ||
      contextLower.includes('portrait') || contextLower.includes('person')) {
    return 'headshot';
  }
  
  // Product images
  if (name.includes('product') || name.includes('item') || name.includes('merchandise') ||
      name.includes('catalog') || name.includes('inventory') ||
      contextLower.includes('product') || contextLower.includes('catalog')) {
    return 'product';
  }
  
  // Screenshots
  if (name.includes('screenshot') || name.includes('screen') || name.includes('ui') ||
      name.includes('interface') || name.includes('app') || name.includes('software') ||
      contextLower.includes('app') || contextLower.includes('software') ||
      contextLower.includes('interface')) {
    return 'screenshot';
  }
  
  // Brand and logos
  if (name.includes('logo') || name.includes('brand') || name.includes('identity') ||
      name.includes('mark') || name.includes('symbol') ||
      contextLower.includes('logo') || contextLower.includes('brand')) {
    return 'logo';
  }
  
  // Documents
  if (name.includes('document') || name.includes('pdf') || name.includes('file') ||
      name.includes('report') || name.includes('guide') || name.includes('manual') ||
      contextLower.includes('document') || contextLower.includes('report') ||
      contextLower.includes('guide') || contextLower.includes('manual')) {
    return 'document';
  }
  
  // Default to 'other' for generic filenames without clear context
  return 'other';
}

/**
 * Map ML category to business category
 * @param {string} mlCategory - ML classification result
 * @returns {string} Business category
 */
function mapToBusinessCategory(mlCategory) {
  const categoryMap = {
    'person': 'headshot',
    'face': 'headshot',
    'portrait': 'headshot',
    'product': 'product',
    'object': 'product',
    'item': 'product',
    'screen': 'screenshot',
    'computer': 'screenshot',
    'monitor': 'screenshot',
    'logo': 'logo',
    'brand': 'logo',
    'text': 'logo'
  };
  
  return categoryMap[mlCategory] || 'other';
}

/**
 * Check if face detection should be run
 * @param {string} imageUrl - URL of the image
 * @param {Object} analysis - Current analysis results
 * @returns {boolean} Whether to detect faces
 */
function shouldDetectFaces(imageUrl, analysis = {}) {
  // Always run face detection for all images to get accurate results
  return true;
}

/**
 * Check if color analysis should be run
 * @param {string} imageUrl - URL of the image
 * @returns {boolean} Whether to analyze colors
 */
function shouldAnalyzeColors(imageUrl) {
  const name = imageUrl.toLowerCase();
  return name.includes('brand') || name.includes('logo') || name.includes('design');
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
 * Get dominant colors from image data
 * @param {ImageData} imageData - Image data
 * @returns {Object} Color analysis
 */
function getDominantColors(imageData) {
  const data = imageData.data;
  const colorCounts = {};
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < data.length; i += 40) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const color = `rgb(${r},${g},${b})`;
    colorCounts[color] = (colorCounts[color] || 0) + 1;
  }
  
  const sortedColors = Object.entries(colorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  return {
    dominant: sortedColors[0]?.[0] || null,
    palette: sortedColors.map(([color]) => color)
  };
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
