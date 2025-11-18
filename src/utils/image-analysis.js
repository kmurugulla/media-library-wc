export const ANALYSIS_CONFIG = {
  enabled: true,
  extractEXIF: true,
  extractDimensions: true,
  analyzeUsage: true,
};

const analysisCache = new Map();

async function getImageDimensions(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function onImageLoad() {
      resolve({
        width: this.naturalWidth,
        height: this.naturalHeight,
      });
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = imageUrl;
  });
}

async function extractEXIFData(imageUrl) {
  try {
    const exifr = await import(/* @vite-ignore */ 'exifr');

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return {
        error: true,
        errorType: response.status === 404 ? '404' : 'http_error',
        errorMessage: `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    const blob = await response.blob();
    const exifData = await exifr.parse(blob, { pick: ['Make', 'Model', 'DateTime'] });

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
      camera,
      dateTime: exifData.DateTime,
    };
  } catch (error) {
    return {
      error: true,
      errorType: 'parse_error',
      errorMessage: error.message,
      statusCode: null,
    };
  }
}

function getBasicAnalysis() {
  return {
    orientation: 'unknown',
    width: 0,
    height: 0,
    confidence: 'none',
    source: 'basic',
  };
}

async function hasContentChanged(imageUrl, existingAnalysis) {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const currentETag = response.headers.get('ETag');
    const currentLastModified = response.headers.get('Last-Modified');

    return currentETag !== existingAnalysis.etag
           || currentLastModified !== existingAnalysis.lastModified;
  } catch (error) {
    return true;
  }
}

async function runAnalysisPipeline(imageUrl, context = '') {
  const analysis = {
    source: 'analysis',
    confidence: 'low',
  };

  if (ANALYSIS_CONFIG.extractDimensions) {
    const dimensions = await getImageDimensions(imageUrl);
    analysis.width = dimensions.width;
    analysis.height = dimensions.height;
    if (dimensions.width === dimensions.height) {
      analysis.orientation = 'square';
    } else {
      analysis.orientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait';
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
        if (exifData.camera || exifData.date) {
          analysis.confidence = 'high';
        }
      }
    }
  }

  return analysis;
}

async function getImageContentHash(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    return imageUrl;
  }
}

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
    return getBasicAnalysis(imageUrl);
  }
}

export function updateAnalysisConfig(config) {
  Object.assign(ANALYSIS_CONFIG, config);
}

export function getAnalysisConfig() {
  return { ...ANALYSIS_CONFIG };
}

export function clearAnalysisCache() {
  analysisCache.clear();
}

if (typeof window !== 'undefined') {
  window.clearAnalysisCache = clearAnalysisCache;
}
