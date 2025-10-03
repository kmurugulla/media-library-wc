// eslint-disable-next-line import/named
import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';
import { WordPressSource } from '../../sources/index.js';
import domCache from '../shared/utils/dom-cache.js';
import CONFIG from '../shared/utils/constants.js';
import { getFormData, validateFormData } from '../shared/utils/form-utils.js';
import { showNotification, handleError } from '../shared/utils/error-handler.js';
import { initializeApp } from '../shared/utils/app-initializer.js';

let mediaLibrary;

function normalizeUrl(url) {
  if (!url) return url;

  let normalizedUrl = url.trim();

  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  return normalizedUrl;
}

async function loadAvailableSites() {
  let storage = null;
  try {
    const storageType = domCache.storageSelect?.value || CONFIG.DEFAULT_STORAGE;
    storage = createStorage(storageType);

    const sites = await storage.getAllSites();
    const currentSelection = domCache.siteSelector?.value;

    domCache.siteSelector.innerHTML = '<option value="">Select a site...</option>';

    sites.forEach((site) => {
      const option = document.createElement('option');
      option.value = site.siteKey;
      option.textContent = `${site.siteKey} (${site.itemCount} items) - ${new Date(site.timestamp).toLocaleString()}`;
      domCache.siteSelector.appendChild(option);
    });

    if (sites.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No sites found';
      option.disabled = true;
      domCache.siteSelector.appendChild(option);
      domCache.deleteSiteButton.style.display = 'none';
    } else {
      if (currentSelection && sites.some((site) => site.siteKey === currentSelection)) {
        domCache.siteSelector.value = currentSelection;
        domCache.deleteSiteButton.style.display = 'inline-block';
        return;
      }
      domCache.deleteSiteButton.style.display = 'none';
    }
  } catch (error) {
    handleError(error, 'Failed to load available sites');
  } finally {
    if (storage && storage.closeConnection) {
      storage.closeConnection();
    }
  }
}

async function performWordPressScan() {
  try {
    const formData = getFormData();
    validateFormData(formData);

    domCache.scanButton.disabled = true;
    domCache.scanButton.textContent = 'Scanning...';

    const dataSource = new WordPressSource();
    const postTypes = [];

    if (formData.includePosts) postTypes.push('posts');
    if (formData.includePages) postTypes.push('pages');
    if (formData.includeMedia) postTypes.push('media');

    const options = {
      postTypes,
      perPage: 100,
      maxPages: 10,
    };

    const normalizedWebsiteUrl = normalizeUrl(formData.websiteUrl);
    const pageList = await dataSource.getPageList(normalizedWebsiteUrl, options);
    const siteKey = mediaLibrary.generateSiteKey(normalizedWebsiteUrl);

    await mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    loadAvailableSites();
  } catch (error) {
    handleError(error, 'WordPress scan failed');
  } finally {
    domCache.scanButton.disabled = false;
    domCache.scanButton.textContent = 'Scan WordPress Site';
  }
}

function setupControls() {
  loadAvailableSites();
}

window.refreshSites = loadAvailableSites;

document.addEventListener('DOMContentLoaded', async () => {
  mediaLibrary = document.getElementById('media-library');

  await waitForMediaLibraryReady(mediaLibrary);

  await initializeApp(mediaLibrary, performWordPressScan);
  setupControls();
});
