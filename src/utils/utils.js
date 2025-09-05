// src/utils/utils.js

// ============================================================================
// MEDIA TYPE CONSTANTS AND UTILITIES
// ============================================================================

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi'];
export const DOCUMENT_EXTENSIONS = ['pdf'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav'];
export const MEDIA_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
];

function extractFileExtension(filePath) {
  if (!filePath) return '';
  
  try {
    // Remove query parameters and fragments using regex (more robust)
    const cleanUrl = filePath.split(/[?#]/)[0];
    
    // Extract the file extension
    const extension = cleanUrl.split('.').pop()?.toLowerCase() || '';
    
    // Validate the extension - ensure it's not empty and different from the entire URL
    // Also check it doesn't contain invalid characters (like spaces, slashes, etc.)
    if (!extension || extension === cleanUrl || /[^a-z0-9]/.test(extension)) {
      return '';
    }
    
    return extension;
  } catch (error) {
    console.warn('Error extracting file extension from URL:', filePath, error);
    return '';
  }
}

function isSvgFile(media) {
  const type = media.type || '';
  return type === 'img > svg' || type === 'link > svg';
}

export function detectMediaTypeFromExtension(ext) {
  if (IMAGE_EXTENSIONS.includes(ext)) return 'img';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  return 'unknown';
}

export function getMediaType(media) {
  const type = media.type || '';
  if (type.startsWith('img >')) return 'image';
  if (type.startsWith('video >')) return 'video';
  if (type.startsWith('document >')) return 'document';
  if (type.startsWith('link >')) return 'link';

  const mediaUrl = media.url || '';
  const ext = extractFileExtension(mediaUrl);
  return detectMediaTypeFromExtension(ext);
}

export function getSubtype(media) {
  const type = media.type || '';
  if (!type.includes(' > ')) return '';

  const [, subtype] = type.split(' > ');
  return subtype.toUpperCase();
}

export function getDisplayMediaType(media) {
  if (media.type) {
    if (media.type.includes(' > ')) {
      const [baseType, subtype] = media.type.split(' > ');
      const baseLabels = {
        img: 'IMAGE',
        video: 'VIDEO',
        'video-source': 'VIDEO SOURCE',
        link: 'LINK',
        background: 'BACKGROUND',
      };
      const baseLabel = baseLabels[baseType] || baseType.toUpperCase();
      return `${baseLabel} (${subtype.toUpperCase()})`;
    }

    const typeLabels = {
      img: 'IMAGE',
      video: 'VIDEO',
      'video-source': 'VIDEO SOURCE',
      link: 'LINK',
      background: 'BACKGROUND',
    };
    return typeLabels[media.type] || media.type.toUpperCase();
  }

  const mediaUrl = media.url || '';
  const ext = extractFileExtension(mediaUrl);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'IMAGE';
  if (ext === 'mp4') return 'VIDEO';
  if (ext === 'pdf') return 'DOCUMENT';
  return 'UNKNOWN';
}

export function isMediaFile(ext) {
  let cleanExt = ext;
  if (cleanExt && cleanExt.startsWith('.')) {
    cleanExt = cleanExt.substring(1);
  }
  const lowerExt = cleanExt?.toLowerCase();
  return MEDIA_EXTENSIONS.includes(lowerExt);
}

export { isSvgFile, extractFileExtension };

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort media data by lastUsedAt (recent first) then alphabetically by name
 * @param {Array} mediaData - Media data to sort
 * @returns {Array} Sorted media data
 */
export function sortMediaData(mediaData) {
  return [...mediaData].sort((a, b) => {
    // Sort by recently used first, then alphabetical
    const lastUsedA = new Date(a.lastUsedAt || 0);
    const lastUsedB = new Date(b.lastUsedAt || 0);
    const timeDiff = lastUsedB - lastUsedA;

    if (timeDiff !== 0) return timeDiff;

    // Fallback to alphabetical
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

// ============================================================================
// VIDEO UTILITIES
// ============================================================================

export function getVideoThumbnail(videoUrl) {
  if (!videoUrl) return null;

  const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
  }

  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return `https://i.vimeocdn.com/video/${videoId}_640.jpg`;
  }

  return null;
}

export function isExternalVideoUrl(url) {
  if (!url) return false;

  const supportedPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)/,
    /vimeo\.com\/(\d+)/,
  ];

  return supportedPatterns.some((pattern) => pattern.test(url));
}

// ============================================================================
// CORE UTILITIES
// ============================================================================

export function createHash(str) {
  // Use a more robust hash algorithm
  let hash = 0;
  if (str.length === 0) return hash.toString(36).padStart(10, '0');

  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = ((hash * 33) + char) % 2147483647;
  }

  // Convert to base36 and ensure minimum length of 10 characters
  const base36 = Math.abs(hash).toString(36);
  return base36.padStart(10, '0');
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`;
}

export function extractMediaLocation(mediaUrl) {
  try {
    const url = new URL(mediaUrl);
    return {
      origin: url.origin,
      path: url.pathname,
      fullUrl: mediaUrl,
    };
  } catch (error) {
    // If it's not a valid URL, treat it as a relative path
    return {
      origin: '',
      path: mediaUrl,
      fullUrl: mediaUrl,
    };
  }
}

export function normalizeUrl(url) {
  if (!url) return '';

  // Remove protocol and domain to get just the path
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // If it's not a valid URL, return as is (might be a relative path)
    return url;
  }
}

export function urlsMatch(url1, url2) {
  if (!url1 || !url2) return false;

  // Normalize both URLs to just their paths
  const path1 = normalizeUrl(url1);
  const path2 = normalizeUrl(url2);

  // Direct match
  if (path1 === path2) return true;

  // Handle cases where one might have leading slash and other doesn't
  const normalizedPath1 = path1.startsWith('/') ? path1 : `/${path1}`;
  const normalizedPath2 = path2.startsWith('/') ? path2 : `/${path2}`;

  if (normalizedPath1 === normalizedPath2) return true;

  // Handle relative paths by comparing file names
  const fileName1 = path1.split('/').pop();
  const fileName2 = path2.split('/').pop();

  return fileName1 === fileName2 && fileName1 && fileName2;
}

export function groupUsagesByPath(usages) {
  const grouped = new Map();

  usages.forEach((usage) => {
    const docPath = usage.doc || 'Unknown Document';
    if (!grouped.has(docPath)) {
      grouped.set(docPath, []);
    }
    grouped.get(docPath).push(usage);
  });

  return Array.from(grouped.entries()).map(([path, usageList]) => ({
    path,
    usages: usageList,
    count: usageList.length,
  }));
}

export function createElement(tag, attributes = {}, content = undefined) {
  const element = document.createElement(tag);

  if (attributes) {
    Object.entries(attributes).forEach(([key, val]) => {
      switch (key) {
        case 'className':
          element.className = val;
          break;
        case 'dataset':
          Object.assign(element.dataset, val);
          break;
        case 'textContent':
          element.textContent = val;
          break;
        case 'innerHTML':
          element.innerHTML = val;
          break;
        case 'style':
          if (typeof val === 'object') {
            Object.assign(element.style, val);
          } else {
            element.style.cssText = val;
          }
          break;
        case 'events':
          Object.entries(val).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
          });
          break;
        default:
          element.setAttribute(key, val);
      }
    });
  }

  if (content) {
    if (Array.isArray(content)) {
      element.append(...content);
    } else if (content instanceof HTMLElement || content instanceof SVGElement) {
      element.append(content);
    } else {
      element.insertAdjacentHTML('beforeend', content);
    }
  }

  return element;
}

export async function copyImageToClipboard(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();

  let clipboardBlob = blob;
  let mimeType = blob.type;

  if (!['image/png', 'image/gif', 'image/webp'].includes(blob.type)) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    clipboardBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    mimeType = 'image/png';

    URL.revokeObjectURL(img.src);
  }

  const clipboardItem = new ClipboardItem({ [mimeType]: clipboardBlob });
  await navigator.clipboard.write([clipboardItem]);
}

export async function copyMediaToClipboard(media) {
  const mediaUrl = media.url;
  const mediaType = getMediaType(media);

  try {
    if (mediaType === 'image') {
      // Copy actual image to clipboard
      await copyImageToClipboard(mediaUrl);
      return { heading: 'Copied', message: 'Image copied to clipboard.' };
    }
    // For non-images, copy the URL as text
    await navigator.clipboard.writeText(mediaUrl);
    return { heading: 'Copied', message: 'Media URL copied to clipboard.' };
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return { heading: 'Error', message: 'Failed to copy to clipboard.' };
  }
}

// URL path extraction utilities
export function getFileName(url) {
  try {
    const urlObj = new URL(url);
    const { pathname } = urlObj;
    return pathname.split('/').pop() || '';
  } catch {
    return url.split('/').pop() || '';
  }
}

export function extractRelativePath(fullPath) {
  if (!fullPath) return fullPath;

  const pathParts = fullPath.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    return `/${pathParts.slice(2).join('/')}`;
  }
  return fullPath;
}

export function getDisplayName(fullPath) {
  if (!fullPath) return '';

  // Extract just the filename from the path
  const pathParts = fullPath.split('/').filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];

  // Remove file extension for cleaner display
  return fileName.replace(/\.[^/.]+$/, '');
}

// File type detection utilities
export function isImage(url) {
  const ext = extractFileExtension(url);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext);
}

export function isVideo(url) {
  const ext = extractFileExtension(url);
  return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
}

export function isPdf(url) {
  const ext = extractFileExtension(url);
  return ext === 'pdf';
}
