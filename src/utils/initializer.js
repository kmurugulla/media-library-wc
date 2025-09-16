export function waitForMediaLibraryReady(mediaLibraryElement) {
  return new Promise((resolve, reject) => {
    if (mediaLibraryElement.isReady) {
      resolve(mediaLibraryElement);
      return;
    }

    let isResolved = false;
    let handleReady;
    let handleError;

    const cleanup = () => {
      if (!isResolved && handleReady && handleError) {
        mediaLibraryElement.removeEventListener('media-library-ready', handleReady);
        mediaLibraryElement.removeEventListener('media-library-error', handleError);
      }
    };

    handleReady = (event) => {
      if (event.target === mediaLibraryElement && !isResolved) {
        isResolved = true;
        cleanup();
        resolve(mediaLibraryElement);
      }
    };

    handleError = (event) => {
      if (event.target === mediaLibraryElement && !isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error(`Media library initialization failed: ${event.detail.error.message}`));
      }
    };

    mediaLibraryElement.addEventListener('media-library-ready', handleReady);
    mediaLibraryElement.addEventListener('media-library-error', handleError);

    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error('Media library initialization timeout'));
      }
    }, 10000);
  });
}

export async function initializeMediaLibrary(elementId) {
  const mediaLibraryElement = document.getElementById(elementId);

  if (!mediaLibraryElement) {
    throw new Error(`Media library element with id "${elementId}" not found`);
  }

  return waitForMediaLibraryReady(mediaLibraryElement);
}

export async function createMediaLibrary(options = {}) {
  const { storage = 'none', locale = 'en', containerId } = options;

  const mediaLibraryElement = document.createElement('media-library');
  mediaLibraryElement.storage = storage;
  mediaLibraryElement.locale = locale;

  const container = containerId ? document.getElementById(containerId) : document.body;
  container.appendChild(mediaLibraryElement);

  return waitForMediaLibraryReady(mediaLibraryElement);
}

export async function waitForMediaLibraryInit(mediaLibraryElement) {
  console.warn('waitForMediaLibraryInit() is deprecated. Use waitForMediaLibraryReady() instead.');
  return waitForMediaLibraryReady(mediaLibraryElement);
}
