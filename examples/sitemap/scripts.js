import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';
import { SitemapSource } from '../../sources/index.js';

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
    const BrowserStorage = mediaLibrary.storageManager.constructor;
    const indexDBStorage = new BrowserStorage('indexeddb');

    const sites = await indexDBStorage.getAllSites();

    const siteSelector = document.getElementById('site-selector');
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
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load available sites:', error);
    showNotification(`Failed to load sites: ${error.message}`, 'error');
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

async function performSitemapScan() {
  const websiteUrl = document.getElementById('website-url').value.trim();
  const sitemapUrl = document.getElementById('sitemap-url').value.trim();

  if (!websiteUrl && !sitemapUrl) {
    showNotification('Please enter a website URL or sitemap URL', 'error');
    return;
  }

  const scanBtn = document.getElementById('scan-btn');
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';

  try {
    const source = new SitemapSource();
    let pageList;

    const normalizedWebsiteUrl = websiteUrl ? normalizeUrl(websiteUrl) : websiteUrl;
    const normalizedSitemapUrl = sitemapUrl ? normalizeUrl(sitemapUrl) : sitemapUrl;

    if (normalizedSitemapUrl) {
      pageList = await source.getPageList(normalizedWebsiteUrl, normalizedSitemapUrl);
    } else {
      pageList = await source.getPageList(normalizedWebsiteUrl);
    }

    if (!pageList || pageList.length === 0) {
      showNotification('No pages found in sitemap', 'error');
      return;
    }

    showNotification(`Found ${pageList.length} pages, starting scan...`, 'info');

    const siteKey = new URL(normalizedWebsiteUrl || normalizedSitemapUrl).hostname;
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey, true);

    showNotification(`Scan complete! Found ${mediaData.length} media files.`, 'success');
  } catch (error) {
    let errorMessage = error.message;

    if (error.message.includes('CORS')) {
      errorMessage = 'CORS Error: Please use the CORS proxy server or try a different website.';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Network Error: Please check your internet connection and try again.';
    } else if (error.message.includes('Invalid URL')) {
      errorMessage = 'Invalid URL: Please enter a valid website URL.';
    } else if (error.message.includes('No sitemap found')) {
      errorMessage = 'No sitemap found: This website may not have a sitemap.xml file.';
    } else if (error.message.includes('Proxy Error')) {
      errorMessage = `Proxy Error: ${error.message}. All proxy services failed.`;
    }

    showNotification(`Scan failed: ${errorMessage}`, 'error');
    // eslint-disable-next-line no-console
    console.error('Scan error:', error);
  } finally {
    const btn = document.getElementById('scan-btn');
    btn.disabled = false;
    btn.textContent = 'Scan Sitemap';
  }
}

function setupControls() {
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');

  storageSelect.addEventListener('change', (e) => {
    const previousStorage = mediaLibrary.storage;
    const newStorage = e.target.value;

    mediaLibrary.storage = newStorage;

    const BrowserStorage = mediaLibrary.storageManager.constructor;
    mediaLibrary.storageManager = new BrowserStorage(newStorage);

    mediaLibrary.clearData();

    if (previousStorage !== 'indexdb' && newStorage === 'indexdb') {
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
      await mediaLibrary.loadFromStorage(selectedSite);
      showNotification(`Loaded data for site: ${selectedSite}`, 'success');
    } else {
      mediaLibrary.clearData();
    }
  });

  scanBtn.addEventListener('click', async () => {
    await performSitemapScan();
  });

  clearBtn.addEventListener('click', () => {
    mediaLibrary.clearData();
  });

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
    // eslint-disable-next-line no-console
    console.error('Error applying URL parameters:', error);
    showNotification(`Error loading URL parameters: ${error.message}`, 'error');
  }
}

window.refreshSites = loadAvailableSites;

window.clearOldData = async () => {
  try {
    const storage = mediaLibrary.storageManager;

    if (!storage) {
      showNotification('Storage manager not available', 'error');
      return;
    }

    const oldData = await storage.load('media-data');
    if (oldData && oldData.length > 0) {
      // eslint-disable-next-line no-alert, no-restricted-globals
      const shouldMigrate = confirm(`Found ${oldData.length} items in old format. Would you like to migrate them to 'legacy-data' site before clearing?`);
      if (shouldMigrate) {
        await storage.save(oldData, 'legacy-data');
        showNotification(`Migrated ${oldData.length} items to 'legacy-data' site`, 'success');
      }
    }

    await storage.clear();
    await loadAvailableSites();
    showNotification('Old data cleared successfully', 'success');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear old data:', error);
    showNotification(`Failed to clear data: ${error.message}`, 'error');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  mediaLibrary = document.getElementById('media-library');

  await waitForMediaLibraryReady(mediaLibrary);

  setupControls();
  setupNotifications();

  applyURLParameters();
});
