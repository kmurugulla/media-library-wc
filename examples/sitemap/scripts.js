/* eslint-disable no-console, no-alert, no-restricted-globals */
import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';
import { SitemapSource } from '../../sources/index.js';
import BrowserStorage from '../../src/utils/storage.js';

let mediaLibrary;

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => document.body.removeChild(notification), 300);
  }, 3000);
}

async function loadAvailableSites() {
  try {
    const indexDBStorage = new BrowserStorage('indexeddb');

    const sites = await indexDBStorage.getAllSites();

    const siteSelector = document.getElementById('site-selector');
    const deleteSiteBtn = document.getElementById('delete-site-btn');
    const clearStorageBtn = document.getElementById('clear-storage-btn');

    siteSelector.innerHTML = '<option value="">Select a site...</option>';

    sites.forEach((site) => {
      const option = document.createElement('option');
      option.value = site.siteKey;
      option.textContent = `${site.siteKey} (${site.itemCount} items) - ${new Date(site.timestamp).toLocaleString()}`;
      siteSelector.appendChild(option);
    });

    if (sites.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No sites found';
      option.disabled = true;
      siteSelector.appendChild(option);
      deleteSiteBtn.style.display = 'none';
      clearStorageBtn.style.display = 'none';
    } else {
      clearStorageBtn.style.display = 'inline-block';
      deleteSiteBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load available sites:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    showNotification('Failed to load sites: Check console for details', 'error');
  }
}

function normalizeUrl(url) {
  if (!url) return url;

  let normalizedUrl = url.trim();

  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  return normalizedUrl;
}

function disableFormFields() {
  document.getElementById('website-url').disabled = true;
  document.getElementById('sitemap-url').disabled = true;
  document.getElementById('storage-type').disabled = true;
  document.getElementById('locale').disabled = true;
}

function enableFormFields() {
  document.getElementById('website-url').disabled = false;
  document.getElementById('sitemap-url').disabled = false;
  document.getElementById('storage-type').disabled = false;
  document.getElementById('locale').disabled = false;
}

async function performSitemapScan() {
  const websiteUrl = document.getElementById('website-url').value.trim();
  const sitemapUrl = document.getElementById('sitemap-url').value.trim();

  if (!websiteUrl && !sitemapUrl) {
    showNotification('Please enter a website URL or sitemap URL', 'error');
    return;
  }

  const scanBtn = document.getElementById('scan-btn');
  scanBtn.disabled = true;
  disableFormFields();

  try {
    const corsProxyUrl = 'https://media-library-cors-proxy.aem-poc-lab.workers.dev/';
    const source = new SitemapSource({
      corsProxy: corsProxyUrl,
      useCorsProxy: true,
    });
    let pageList;

    const normalizedWebsiteUrl = websiteUrl ? normalizeUrl(websiteUrl) : websiteUrl;
    const normalizedSitemapUrl = sitemapUrl ? normalizeUrl(sitemapUrl) : sitemapUrl;

    if (normalizedSitemapUrl) {
      scanBtn.textContent = 'Fetching sitemap...';
      pageList = await source.getPageList(normalizedWebsiteUrl, normalizedSitemapUrl);
    } else {
      scanBtn.textContent = 'Discovering sitemap...';
      pageList = await source.getPageList(normalizedWebsiteUrl);
    }

    if (!pageList || pageList.length === 0) {
      showNotification('No pages found in sitemap', 'error');
      return;
    }

    scanBtn.textContent = 'Parsing sitemap...';
    enableFormFields();

    const siteKey = new URL(normalizedWebsiteUrl || normalizedSitemapUrl).hostname;
    scanBtn.textContent = 'Scanning...';

    mediaLibrary.storage = 'indexeddb';
    await mediaLibrary.initialize();

    const siteStorageManager = new BrowserStorage('indexeddb', siteKey);
    mediaLibrary.storageManager = siteStorageManager;

    const existingMediaData = await siteStorageManager.load();

    const previousMetadata = await siteStorageManager.loadScanMetadata();

    const changedPages = previousMetadata
      ? source.filterChangedUrls(pageList, previousMetadata)
      : pageList;

    if (changedPages.length === 0) {
      showNotification('No changes detected - scan not needed', 'info');
      return;
    }

    const shouldSaveMedia = document.getElementById('storage-type').value === 'indexeddb';
    const mediaData = await mediaLibrary.loadFromPageList(
      changedPages,
      null,
      siteKey,
      shouldSaveMedia,
      previousMetadata,
      pageList,
      existingMediaData,
    );

    showNotification(`Scan complete! Found ${mediaData.length} media files.`, 'success');
  } catch (error) {
    console.error('Sitemap scan failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      websiteUrl,
      sitemapUrl,
    });

    showNotification('Scan failed: Check console for detailed error information', 'error');
  } finally {
    const btn = document.getElementById('scan-btn');
    btn.disabled = false;
    btn.textContent = 'Scan Sitemap';
    enableFormFields();
  }
}

function setupControls() {
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const deleteSiteBtn = document.getElementById('delete-site-btn');
  const clearStorageBtn = document.getElementById('clear-storage-btn');

  storageSelect.addEventListener('change', async (e) => {
    const previousStorage = mediaLibrary.storage;
    const newStorage = e.target.value;

    mediaLibrary.storage = newStorage;

    await mediaLibrary.clearData();

    if (previousStorage !== 'indexeddb' && newStorage === 'indexeddb') {
      showNotification('Switched to IndexDB storage - future scans will be saved', 'info');
    }

    loadAvailableSites();
  });

  localeSelect.addEventListener('change', (e) => {
    mediaLibrary.locale = e.target.value;
  });

  siteSelector.addEventListener('change', async (e) => {
    const selectedSite = e.target.value;
    if (selectedSite) {
      try {
        const siteStorageManager = new BrowserStorage('indexeddb', selectedSite);

        const mediaData = await siteStorageManager.load();
        const metadata = await siteStorageManager.loadScanMetadata();

        await mediaLibrary.loadMediaData(mediaData, null, false, metadata);

        showNotification(`Loaded data for site: ${selectedSite}`, 'success');
        deleteSiteBtn.style.display = 'inline-block';
      } catch (error) {
        console.error(`Failed to load data for site: ${selectedSite}`, error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          selectedSite,
        });
        showNotification('Failed to load site data: Check console for details', 'error');
      }
    } else {
      await mediaLibrary.clearData();
      deleteSiteBtn.style.display = 'none';
    }
  });

  scanBtn.addEventListener('click', async () => {
    await performSitemapScan();
  });

  deleteSiteBtn.addEventListener('click', async () => {
    const selectedSite = siteSelector.value;
    if (selectedSite) {
      const confirmed = confirm(`Are you sure you want to delete all data for "${selectedSite}"? This action cannot be undone.`);
      if (confirmed) {
        try {
          const indexDBStorage = new BrowserStorage('indexeddb');
          await indexDBStorage.deleteSiteFromIndexedDB(selectedSite);
          showNotification(`Deleted data for site: ${selectedSite}`, 'success');

          await mediaLibrary.clearData();

          await loadAvailableSites();

          siteSelector.value = '';
        } catch (error) {
          console.error(`Failed to delete site data: ${selectedSite}`, error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            selectedSite,
          });
          showNotification('Failed to delete site data: Check console for details', 'error');
        }
      }
    }
  });

  clearStorageBtn.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to clear ALL stored data? This action cannot be undone.');
    if (confirmed) {
      try {
        const indexDBStorage = new BrowserStorage('indexeddb');
        await indexDBStorage.clearAllSites();
        showNotification('All stored data cleared successfully', 'success');

        await mediaLibrary.clearData();

        await loadAvailableSites();

        siteSelector.value = '';
      } catch (error) {
        console.error('Failed to clear storage:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        showNotification('Failed to clear storage: Check console for details', 'error');
      }
    }
  });

  const websiteUrlInput = document.getElementById('website-url');
  const sitemapUrlInput = document.getElementById('sitemap-url');

  const handleUrlChange = () => {
    if (mediaLibrary.showAnalysisToggle === false) {
      mediaLibrary.showAnalysisToggle = true;
      mediaLibrary.requestUpdate();
    }
  };

  websiteUrlInput.addEventListener('input', handleUrlChange);
  sitemapUrlInput.addEventListener('input', handleUrlChange);

  loadAvailableSites();
}

function setupNotifications() {
  window.addEventListener('show-notification', (e) => {
    const { heading, message, type } = e.detail;
    showNotification(`${heading}: ${message}`, type);
  });
}

function parseURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {};

  for (const [key, value] of urlParams.entries()) {
    params[key] = decodeURIComponent(value);
  }

  return params;
}

function applyURLParameters() {
  const params = parseURLParameters();

  if (Object.keys(params).length === 0) {
    return;
  }

  try {
    if (params.url) {
      const websiteUrlInput = document.getElementById('website-url');
      if (websiteUrlInput) {
        websiteUrlInput.value = params.url;
      }
    }

    if (params.sitemap) {
      const sitemapUrlInput = document.getElementById('sitemap-url');
      if (sitemapUrlInput) {
        sitemapUrlInput.value = params.sitemap;
      }
    }

    if (params.storage) {
      const storageSelect = document.getElementById('storage-type');
      if (storageSelect) {
        storageSelect.value = params.storage;
        storageSelect.dispatchEvent(new Event('change'));
      }
    }

    if (params.locale) {
      const localeSelect = document.getElementById('locale');
      if (localeSelect) {
        localeSelect.value = params.locale;
        localeSelect.dispatchEvent(new Event('change'));
      }
    }

    if (params.load) {
      const siteSelector = document.getElementById('site-selector');
      if (siteSelector) {
        setTimeout(() => {
          siteSelector.value = params.load;
          siteSelector.dispatchEvent(new Event('change'));
        }, 500);
      }
    }

    if (params.autoscan === 'true') {
      setTimeout(() => {
        performSitemapScan();
      }, 1000);
    }

    showNotification('Configuration loaded from URL parameters', 'info');
  } catch (error) {
    console.error('Error applying URL parameters:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      params,
    });
    showNotification('Error loading URL parameters: Check console for details', 'error');
  }
}

window.refreshSites = loadAvailableSites;

document.addEventListener('DOMContentLoaded', async () => {
  mediaLibrary = document.getElementById('media-library');

  await waitForMediaLibraryReady(mediaLibrary);

  setupControls();
  setupNotifications();

  applyURLParameters();
});
