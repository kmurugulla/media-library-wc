import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';
import { SitemapSource, WordPressSource, AEMSource, AdobeDASource } from '../../sources/index.js';

let mediaLibrary;

function setupControls() {
  const dataSourceSelect = document.getElementById('data-source');
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');
  const deleteSiteBtn = document.getElementById('delete-site-btn');

  // Load available sites on initialization
  // eslint-disable-next-line no-use-before-define
  loadAvailableSites();

  dataSourceSelect.addEventListener('change', (e) => {
    // eslint-disable-next-line no-use-before-define
    updateDataSourceOptions(e.target.value);
  });

  storageSelect.addEventListener('change', async (e) => {
    const previousStorage = mediaLibrary.storage;
    const newStorage = e.target.value;

    mediaLibrary.storage = newStorage;

    // Recreate storage manager with new storage type
    mediaLibrary.storageManager = createStorage(newStorage);

    await mediaLibrary.clearData();

    if (previousStorage !== 'indexeddb' && newStorage === 'indexeddb') {
      // eslint-disable-next-line no-use-before-define
      showNotification('Switched to IndexDB storage - future scans will be saved', 'info');
    } else if (previousStorage !== 'r2' && newStorage === 'r2') {
      // eslint-disable-next-line no-use-before-define
      showNotification('Switched to R2 storage - future scans will be saved to cloud', 'info');
    }

    // eslint-disable-next-line no-use-before-define
    loadAvailableSites();
  });

  localeSelect.addEventListener('change', (e) => {
    mediaLibrary.locale = e.target.value;
  });

  siteSelector.addEventListener('change', async (e) => {
    const selectedSite = e.target.value;
    if (selectedSite) {
      await mediaLibrary.loadFromStorage(selectedSite);
      // eslint-disable-next-line no-use-before-define
      showNotification(`Loaded data for site: ${selectedSite}`, 'success');
      // Show Clear Data button and hide Clear All Storage button when site is selected
      deleteSiteBtn.style.display = 'inline-block';
    } else {
      await mediaLibrary.clearData();
      // Hide Clear Data button and show Clear All Storage button when no site is selected
      deleteSiteBtn.style.display = 'none';
    }
  });

  scanBtn.addEventListener('click', async () => {
    await // eslint-disable-next-line no-use-before-define
    performScan();
  });

  clearBtn.addEventListener('click', async () => {
    await mediaLibrary.clearData();
  });

  deleteSiteBtn.addEventListener('click', async () => {
    const selectedSite = siteSelector.value;
    if (selectedSite) {
      // eslint-disable-next-line no-alert, no-restricted-globals
      const confirmed = confirm(`Are you sure you want to delete all data for "${selectedSite}"? This action cannot be undone.`);
      if (confirmed) {
        try {
          const storageType = document.getElementById('storage-type').value || 'indexeddb';
          const storage = createStorage(storageType);
          await storage.deleteSite(selectedSite);

          // Close the storage connection to prevent database locks
          if (storage.closeConnection) {
            storage.closeConnection();
          }

          // eslint-disable-next-line no-use-before-define
          showNotification(`Deleted data for site: ${selectedSite}`, 'success');

          // Clear the current display if the deleted site was loaded
          await mediaLibrary.clearData();

          // Reload the sites list
          await // eslint-disable-next-line no-use-before-define
          loadAvailableSites();

          // Reset the site selector
          siteSelector.value = '';
        } catch (error) {
          // eslint-disable-next-line no-use-before-define
          showNotification(`Failed to delete site data: ${error.message}`, 'error');
        }
      }
    }
  });

  const sitemapGroup = document.getElementById('sitemap-specific-group');
  const aemGroup = document.getElementById('aem-options-group');
  const adobeGroup = document.getElementById('adobe-options-group');
  const websiteGroup = document.getElementById('website-url-group');
  const orDivider = document.getElementById('or-divider');

  sitemapGroup.style.display = 'none';
  aemGroup.style.display = 'none';
  adobeGroup.style.display = 'none';
  websiteGroup.style.display = 'none';
  orDivider.style.display = 'none';

  // eslint-disable-next-line no-use-before-define
  updateDataSourceOptions(dataSourceSelect.value);
  // eslint-disable-next-line no-use-before-define
  loadAvailableSites();
}

function // eslint-disable-next-line no-use-before-define
updateDataSourceOptions(dataSourceType) {
  const sitemapGroup = document.getElementById('sitemap-specific-group');
  const aemGroup = document.getElementById('aem-options-group');
  const adobeGroup = document.getElementById('adobe-options-group');
  const websiteGroup = document.getElementById('website-url-group');
  const orDivider = document.getElementById('or-divider');

  sitemapGroup.classList.remove('show');
  sitemapGroup.style.display = 'none';

  aemGroup.classList.remove('show');
  aemGroup.style.display = 'none';

  adobeGroup.classList.remove('show');
  adobeGroup.style.display = 'none';

  websiteGroup.classList.remove('show');
  websiteGroup.style.display = 'none';

  orDivider.classList.remove('show');
  orDivider.style.display = 'none';

  switch (dataSourceType) {
    case 'sitemap':
      websiteGroup.classList.add('show');
      websiteGroup.style.display = 'block';
      orDivider.classList.add('show');
      orDivider.style.display = 'block';
      sitemapGroup.classList.add('show');
      sitemapGroup.style.display = 'block';
      break;
    case 'wordpress':
      websiteGroup.classList.add('show');
      websiteGroup.style.display = 'block';
      break;
    case 'aem':
      aemGroup.classList.add('show');
      aemGroup.style.display = 'block';
      break;
    case 'adobe-da':
      adobeGroup.classList.add('show');
      adobeGroup.style.display = 'block';
      break;
    default:

      break;
  }

  const sourceInput = document.getElementById('website-url');
  switch (dataSourceType) {
    case 'sitemap':
      sourceInput.placeholder = 'https://example.com';
      break;
    case 'wordpress':
      sourceInput.placeholder = 'https://your-wordpress-site.com';
      break;
    case 'aem':
      sourceInput.placeholder = 'https://your-aem-site.com';
      break;
    case 'adobe-da':
      sourceInput.placeholder = 'https://your-company.scene7.com';
      break;
    default:

      break;
  }
}

function setupNotifications() {
  window.addEventListener('show-notification', (e) => {
    const { heading, message, type } = e.detail;
    // eslint-disable-next-line no-use-before-define
    showNotification(`${heading}: ${message}`, type);
  });
}

function // eslint-disable-next-line no-use-before-define
showNotification(message, type = 'info') {
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

async function // eslint-disable-next-line no-use-before-define
performScan() {
  const dataSourceType = document.getElementById('data-source').value;
  const websiteUrlElement = document.getElementById('website-url');
  const sourceUrl = websiteUrlElement ? websiteUrlElement.value.trim() : '';
  const sitemapUrlElement = document.getElementById('sitemap-url');
  const sitemapUrl = sitemapUrlElement ? sitemapUrlElement.value.trim() : '';

  if (dataSourceType === 'sitemap') {
    if (!sourceUrl && !sitemapUrl) {
      // eslint-disable-next-line no-use-before-define
      showNotification('Please enter either a Website URL or Sitemap URL', 'error');
      return;
    }
  } else if (dataSourceType === 'wordpress' && !sourceUrl) {
    // eslint-disable-next-line no-use-before-define
    showNotification('Please enter a website URL', 'error');
    return;
  }

  try {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';

    let dataSource;
    let options = {};

    switch (dataSourceType) {
      case 'sitemap': {
        dataSource = new SitemapSource();
        if (sitemapUrl) {
          options.sitemapUrl = sitemapUrl;
        }
        break;
      }
      case 'wordpress': {
        dataSource = new WordPressSource();
        const postTypes = ['posts', 'pages', 'media'];
        options = { postTypes, perPage: 100, maxPages: 10 };
        break;
      }
      case 'aem': {
        dataSource = new AEMSource();
        const aemOrgElement = document.getElementById('aem-org');
        const aemRepoElement = document.getElementById('aem-repo');
        const aemOrg = aemOrgElement ? aemOrgElement.value.trim() : '';
        const aemRepo = aemRepoElement ? aemRepoElement.value.trim() : '';
        if (!aemOrg || !aemRepo) {
          throw new Error('Org and Repo are required for AEM/EDS');
        }
        options = { org: aemOrg, repo: aemRepo, maxResults: 1000 };
        break;
      }
      case 'adobe-da': {
        dataSource = new AdobeDASource();
        const adobeOrgElement = document.getElementById('adobe-org');
        const adobeRepoElement = document.getElementById('adobe-repo');
        const adobeOrg = adobeOrgElement ? adobeOrgElement.value.trim() : '';
        const adobeRepo = adobeRepoElement ? adobeRepoElement.value.trim() : '';
        if (!adobeOrg || !adobeRepo) {
          throw new Error('Org and Repo are required for Adobe DA');
        }
        options = { org: adobeOrg, repo: adobeRepo, maxResults: 1000 };
        break;
      }
      default:
        throw new Error(`Unknown data source type: ${dataSourceType}`);
    }

    const normalizedSourceUrl = sourceUrl ? normalizeUrl(sourceUrl) : sourceUrl;
    const normalizedSitemapUrl = sitemapUrl ? normalizeUrl(sitemapUrl) : sitemapUrl;

    let pageList;
    if (dataSourceType === 'sitemap') {
      const primaryUrl = normalizedSitemapUrl || normalizedSourceUrl;
      pageList = await dataSource.getPageList(primaryUrl, null);
    } else if (dataSourceType === 'aem' || dataSourceType === 'adobe-da') {
      pageList = await dataSource.getPageList(null, options);
    } else {
      pageList = await dataSource.getPageList(normalizedSourceUrl, options);
    }

    const primaryUrl = (dataSourceType === 'sitemap') ? (normalizedSitemapUrl || normalizedSourceUrl) : normalizedSourceUrl;
    const siteKey = (dataSourceType === 'aem' || dataSourceType === 'adobe-da')
      ? `${options.org}-${options.repo}`
      : mediaLibrary.generateSiteKey(primaryUrl);

    await mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    // eslint-disable-next-line no-use-before-define
    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    // eslint-disable-next-line no-use-before-define
    loadAvailableSites();
  } catch (error) {
    // Log detailed error to console
    // eslint-disable-next-line no-console
    console.error('Multi-source scan failed:', error);
    // eslint-disable-next-line no-console
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      dataSourceType,
    });

    // Show generic error message to user
    // eslint-disable-next-line no-use-before-define
    showNotification('Scan failed: Check console for detailed error information', 'error');
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan';
  }
}

async function // eslint-disable-next-line no-use-before-define
loadAvailableSites() {
  try {
    const storageType = document.getElementById('storage-type').value || 'indexeddb';
    const storage = createStorage(storageType);

    const sites = await storage.getAllSites();

    const siteSelector = document.getElementById('site-selector');
    const deleteSiteBtn = document.getElementById('delete-site-btn');

    // Store current selection before rebuilding
    const currentSelection = siteSelector.value;

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
    } else if (currentSelection && sites.some((site) => site.siteKey === currentSelection)) {
      // Restore selection if it was valid
      siteSelector.value = currentSelection;
      // Show Clear Data button and hide Clear All Storage button when site is selected
      deleteSiteBtn.style.display = 'inline-block';
    } else {
      // No valid selection, hide both buttons (Clear All should never show)
      deleteSiteBtn.style.display = 'none';
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load available sites:', error);
    // eslint-disable-next-line no-use-before-define
    showNotification(`Failed to load sites: ${error.message}`, 'error');
  }
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
    if (params.source) {
      const dataSourceSelect = document.getElementById('data-source');
      if (dataSourceSelect) {
        dataSourceSelect.value = params.source;
        // eslint-disable-next-line no-use-before-define
        updateDataSourceOptions(params.source);
      }
    }

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

    if (params.org) {
      const aemOrgInput = document.getElementById('aem-org');
      if (aemOrgInput) {
        aemOrgInput.value = params.org;
      }
    }

    if (params.repo) {
      const aemRepoInput = document.getElementById('aem-repo');
      if (aemRepoInput) {
        aemRepoInput.value = params.repo;
      }
    }

    if (params.org) {
      const adobeOrgInput = document.getElementById('adobe-org');
      if (adobeOrgInput) {
        adobeOrgInput.value = params.org;
      }
    }

    if (params.repo) {
      const adobeRepoInput = document.getElementById('adobe-repo');
      if (adobeRepoInput) {
        adobeRepoInput.value = params.repo;
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
        // eslint-disable-next-line no-use-before-define
        performScan();
      }, 1000);
    }

    // eslint-disable-next-line no-use-before-define
    showNotification('Configuration loaded from URL parameters', 'info');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error applying URL parameters:', error);
    // eslint-disable-next-line no-use-before-define
    showNotification(`Error loading URL parameters: ${error.message}`, 'error');
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
