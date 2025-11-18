import domCache from './dom-cache.js';
import { showNotification } from './error-handler.js';

export function parseURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};

  for (const [key, value] of urlParams.entries()) {
    params[key] = decodeURIComponent(value);
  }

  return params;
}

export function applyURLParameters() {
  const params = parseURLParameters();

  if (Object.keys(params).length === 0) {
    return;
  }

  try {
    if (params.url && domCache.websiteUrl) {
      domCache.websiteUrl.value = params.url;
    }

    if (params.posts !== undefined && domCache.includePosts) {
      domCache.includePosts.checked = params.posts === 'true';
    }

    if (params.pages !== undefined && domCache.includePages) {
      domCache.includePages.checked = params.pages === 'true';
    }

    if (params.media !== undefined && domCache.includeMedia) {
      domCache.includeMedia.checked = params.media === 'true';
    }

    if (params.load && domCache.siteSelector) {
      requestAnimationFrame(() => {
        domCache.siteSelector.value = params.load;
        domCache.siteSelector.dispatchEvent(new Event('change'));
      });
    }

    if (params.autoscan === 'true') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('trigger-scan'));
      });
    }

    showNotification('Configuration loaded from URL parameters', 'info');

    if (domCache.configSection && domCache.configToggleButton) {
      domCache.configSection.classList.add('collapsed');
      domCache.configToggleButton.classList.add('collapsed');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error applying URL parameters:', error);
    showNotification(`Error loading URL parameters: ${error.message}`, 'error');
  }
}

export function createURLFromFormData(formData) {
  const params = new URLSearchParams();

  if (formData.websiteUrl) {
    params.set('url', formData.websiteUrl);
  }

  if (formData.includePosts) {
    params.set('posts', 'true');
  }

  if (formData.includePages) {
    params.set('pages', 'true');
  }

  if (formData.includeMedia) {
    params.set('media', 'true');
  }

  if (formData.storageType) {
    params.set('storage', formData.storageType);
  }

  if (formData.locale) {
    params.set('locale', formData.locale);
  }

  return `${window.location.pathname}?${params.toString()}`;
}
