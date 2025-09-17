import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';
import { WordPressSource } from '../../sources/index.js';

let mediaLibrary;

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => document.body.removeChild(notification), 300);
  }, 3000);
}

function normalizeUrl(url) {
  if (!url) return url;

  let normalizedUrl = url.trim();

  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  return normalizedUrl;
}

async function loadAvailableSites() {
  try {
    // Always create a temporary IndexDB storage manager to check for available sites
    // This is independent of the current storage setting
    const BrowserStorage = mediaLibrary.storageManager.constructor;
    const indexDBStorage = new BrowserStorage('indexeddb');

    const sites = await indexDBStorage.getAllSites();

    const siteSelector = document.getElementById('site-selector');
    const deleteSiteBtn = document.getElementById('delete-site-btn');

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
      // Hide delete button when no sites are available
      deleteSiteBtn.style.display = 'none';
    } else {
      // Hide delete button initially (will show when site is selected)
      deleteSiteBtn.style.display = 'none';
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load available sites:', error);
    showNotification(`Failed to load sites: ${error.message}`, 'error');
  }
}

async function performWordPressScan() {
  const websiteUrl = document.getElementById('website-url').value.trim();

  if (!websiteUrl) {
    showNotification('Please enter a WordPress site URL', 'error');
    return;
  }

  try {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';

    const includePosts = document.getElementById('include-posts').checked;
    const includePages = document.getElementById('include-pages').checked;
    const includeMedia = document.getElementById('include-media').checked;

    if (!includePosts && !includePages && !includeMedia) {
      showNotification('Please select at least one content type to scan', 'error');
      return;
    }

    const dataSource = new WordPressSource();
    const postTypes = [];

    if (includePosts) postTypes.push('posts');
    if (includePages) postTypes.push('pages');
    if (includeMedia) postTypes.push('media');

    const options = {
      postTypes,
      perPage: 100,
      maxPages: 10,
    };

    const normalizedWebsiteUrl = normalizeUrl(websiteUrl);
    const pageList = await dataSource.getPageList(normalizedWebsiteUrl, options);
    const siteKey = mediaLibrary.generateSiteKey(normalizedWebsiteUrl);

    mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    loadAvailableSites();
  } catch (error) {
    let errorMessage = error.message;

    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
      errorMessage = `CORS Error: ${error.message}. This is common when testing against external sites.`;
    } else if (error.message.includes('proxy')) {
      errorMessage = `Proxy Error: ${error.message}. All proxy services failed.`;
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      errorMessage = 'WordPress API not found. Please ensure the site URL is correct and the WordPress REST API is enabled.';
    }

    showNotification(`Scan failed: ${errorMessage}`, 'error');
    // eslint-disable-next-line no-console
    console.error('Scan error:', error);
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan WordPress Site';
  }
}

function setupControls() {
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');
  const deleteSiteBtn = document.getElementById('delete-site-btn');
  const configToggleBtn = document.getElementById('config-toggle-btn');
  const configSection = document.getElementById('config-section');

  storageSelect.addEventListener('change', (e) => {
    const previousStorage = mediaLibrary.storage;
    const newStorage = e.target.value;

    mediaLibrary.storage = newStorage;

    // Recreate the storage manager with the new type
    const BrowserStorage = mediaLibrary.storageManager.constructor;
    mediaLibrary.storageManager = new BrowserStorage(newStorage);

    mediaLibrary.clearData();

    // Only show notification when switching to IndexDB (most important change)
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
      // Show delete button when a site is selected
      deleteSiteBtn.style.display = 'inline-block';
    } else {
      mediaLibrary.clearData();
      // Hide delete button when no site is selected
      deleteSiteBtn.style.display = 'none';
    }
  });

  scanBtn.addEventListener('click', async () => {
    await performWordPressScan();
  });

  clearBtn.addEventListener('click', () => {
    mediaLibrary.clearData();
  });

  deleteSiteBtn.addEventListener('click', async () => {
    const selectedSite = siteSelector.value;
    if (selectedSite) {
      // eslint-disable-next-line no-alert, no-restricted-globals
      const confirmed = confirm(`Are you sure you want to delete all data for "${selectedSite}"? This action cannot be undone.`);
      if (confirmed) {
        try {
          const BrowserStorage = mediaLibrary.storageManager.constructor;
          const indexDBStorage = new BrowserStorage('indexeddb');
          await indexDBStorage.deleteSite(selectedSite);
          showNotification(`Deleted data for site: ${selectedSite}`, 'success');

          // Clear the current display if the deleted site was loaded
          mediaLibrary.clearData();

          // Reload the sites list
          await loadAvailableSites();

          // Reset the site selector
          siteSelector.value = '';
        } catch (error) {
          showNotification(`Failed to delete site data: ${error.message}`, 'error');
        }
      }
    }
  });

  if (configToggleBtn && configSection) {
    configToggleBtn.addEventListener('click', () => {
      const isCollapsed = configSection.classList.contains('collapsed');
      if (isCollapsed) {
        configSection.classList.remove('collapsed');
        configToggleBtn.classList.remove('collapsed');
      } else {
        configSection.classList.add('collapsed');
        configToggleBtn.classList.add('collapsed');
      }
    });
  }

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

    if (params.posts !== undefined) {
      const includePostsCheckbox = document.getElementById('include-posts');
      if (includePostsCheckbox) {
        includePostsCheckbox.checked = params.posts === 'true';
      }
    }

    if (params.pages !== undefined) {
      const includePagesCheckbox = document.getElementById('include-pages');
      if (includePagesCheckbox) {
        includePagesCheckbox.checked = params.pages === 'true';
      }
    }

    if (params.media !== undefined) {
      const includeMediaCheckbox = document.getElementById('include-media');
      if (includeMediaCheckbox) {
        includeMediaCheckbox.checked = params.media === 'true';
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
        performWordPressScan();
      }, 1000);
    }

    showNotification('Configuration loaded from URL parameters', 'info');

    const configSection = document.getElementById('config-section');
    const configToggleBtn = document.getElementById('config-toggle-btn');
    if (configSection && configToggleBtn) {
      configSection.classList.add('collapsed');
      configToggleBtn.classList.add('collapsed');
    }
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
