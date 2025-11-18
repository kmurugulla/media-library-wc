import domCache from './dom-cache.js';
import CONFIG from './constants.js';

export function getFormData() {
  return {
    websiteUrl: domCache.websiteUrl?.value?.trim() || '',
    includePosts: domCache.includePosts?.checked || false,
    includePages: domCache.includePages?.checked || false,
    includeMedia: domCache.includeMedia?.checked || false,
  };
}

export function validateFormData(data) {
  if (!data.websiteUrl) {
    throw new Error('Please enter a website URL');
  }

  if (!data.includePosts && !data.includePages && !data.includeMedia) {
    throw new Error('Please select at least one content type to scan');
  }

  return true;
}

export function setFormData(data) {
  if (data.websiteUrl && domCache.websiteUrl) {
    domCache.websiteUrl.value = data.websiteUrl;
  }

  if (data.includePosts !== undefined && domCache.includePosts) {
    domCache.includePosts.checked = data.includePosts;
  }

  if (data.includePages !== undefined && domCache.includePages) {
    domCache.includePages.checked = data.includePages;
  }

  if (data.includeMedia !== undefined && domCache.includeMedia) {
    domCache.includeMedia.checked = data.includeMedia;
  }
}

export function resetForm() {
  if (domCache.websiteUrl) {
    domCache.websiteUrl.value = '';
  }

  if (domCache.includePosts) {
    domCache.includePosts.checked = false;
  }

  if (domCache.includePages) {
    domCache.includePages.checked = false;
  }

  if (domCache.includeMedia) {
    domCache.includeMedia.checked = false;
  }
}
