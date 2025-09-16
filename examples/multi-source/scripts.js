
import '../../dist/media-library.es.js';
import { SitemapSource, WordPressSource, AEMSource, AdobeDASource } from '../../sources/index.js';
import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';

let mediaLibrary;

function setupControls() {
  const dataSourceSelect = document.getElementById('data-source');
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');

  dataSourceSelect.addEventListener('change', (e) => {
    updateDataSourceOptions(e.target.value);
  });

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
    } else {
      mediaLibrary.clearData();
    }
  });

  scanBtn.addEventListener('click', async () => {
    await performScan();
  });

  clearBtn.addEventListener('click', () => {
    mediaLibrary.clearData();
  });

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

  updateDataSourceOptions(dataSourceSelect.value);
  loadAvailableSites();
}

function updateDataSourceOptions(dataSourceType) {
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
    showNotification(`${heading}: ${message}`, type);
  });
}

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

async function performScan() {
  const dataSourceType = document.getElementById('data-source').value;
  const websiteUrlElement = document.getElementById('website-url');
  const sourceUrl = websiteUrlElement ? websiteUrlElement.value.trim() : '';
  const sitemapUrlElement = document.getElementById('sitemap-url');
  const sitemapUrl = sitemapUrlElement ? sitemapUrlElement.value.trim() : '';

  if (dataSourceType === 'sitemap') {
    if (!sourceUrl && !sitemapUrl) {
      showNotification('Please enter either a Website URL or Sitemap URL', 'error');
      return;
    }
  } else if (dataSourceType === 'wordpress' && !sourceUrl) {
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
      case 'sitemap':
        dataSource = new SitemapSource();
        if (sitemapUrl) {
          options.sitemapUrl = sitemapUrl;
        }
        break;
      case 'wordpress':
        dataSource = new WordPressSource();
        const postTypes = ['posts', 'pages', 'media'];
        options = { postTypes, perPage: 100, maxPages: 10 };
        break;
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
    }

    showNotification(`Scan failed: ${errorMessage}`, 'error');
    
    console.error('Scan error:', error);
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan';
  }
}

async function loadAvailableSites() {
  try {
    // Always create a temporary IndexDB storage manager to check for available sites
    // This is independent of the current storage setting
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
    console.error('Failed to load available sites:', error);
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
        performScan();
      }, 1000);
    }

    showNotification('Configuration loaded from URL parameters', 'info');


    if (configSection && configToggleBtn) {
      configSection.classList.add('collapsed');
      configToggleBtn.classList.add('collapsed');
    }
  } catch (error) {
    
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
