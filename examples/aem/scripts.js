
import '../../dist/media-library.es.js';
import { AEMSource } from '../../sources/index.js';
import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';

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

async function loadAvailableSites() {
  try {
    const storageType = document.getElementById('storage-type').value || 'indexeddb';
    const storage = createStorage(storageType);

    const sites = await storage.getAllSites();

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

async function performAEMScan() {
  const aemUrl = document.getElementById('aem-url').value.trim();
  const graphqlEndpoint = document.getElementById('graphql-endpoint').value.trim();
  const contentPath = document.getElementById('content-path').value.trim();
  const maxResults = parseInt(document.getElementById('max-results').value, 10) || 1000;

  if (!aemUrl) {
    showNotification('Please enter an AEM site URL', 'error');
    return;
  }

  try {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';


    const dataSource = new AEMSource();
    const options = {
      graphqlEndpoint,
      contentPath,
      maxResults,
    };

    const pageList = await dataSource.getPageList(aemUrl, options);
    const siteKey = mediaLibrary.generateSiteKey(aemUrl);

    await mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    loadAvailableSites();
  } catch (error) {
    // Log detailed error to console
    // eslint-disable-next-line no-console
    console.error('AEM scan failed:', error);
    // eslint-disable-next-line no-console
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      aemUrl,
      graphqlEndpoint,
      contentPath,
      maxResults,
    });

    // Show generic error message to user
    showNotification('Scan failed: Check console for detailed error information', 'error');
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan AEM Site';
  }
}

function setupControls() {
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');


  storageSelect.addEventListener('change', async (e) => {
    const previousStorage = mediaLibrary.storage;
    const newStorage = e.target.value;
    
    mediaLibrary.storage = newStorage;
    
    // Recreate storage manager with new storage type
    mediaLibrary.storageManager = createStorage(newStorage);
    
    await mediaLibrary.clearData();
    
    if (previousStorage !== 'indexeddb' && newStorage === 'indexeddb') {
      showNotification('Switched to IndexDB storage - future scans will be saved', 'info');
    } else if (previousStorage !== 'r2' && newStorage === 'r2') {
      showNotification('Switched to R2 storage - future scans will be saved to cloud', 'info');
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
      await mediaLibrary.clearData();
    }
  });


  scanBtn.addEventListener('click', async () => {
    await performAEMScan();
  });


  clearBtn.addEventListener('click', () => {
    await mediaLibrary.clearData();
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
      const aemUrlInput = document.getElementById('aem-url');
      if (aemUrlInput) {
        aemUrlInput.value = params.url;
      }
    }


    if (params.endpoint) {
      const graphqlEndpointInput = document.getElementById('graphql-endpoint');
      if (graphqlEndpointInput) {
        graphqlEndpointInput.value = params.endpoint;
      }
    }


    if (params.path) {
      const contentPathInput = document.getElementById('content-path');
      if (contentPathInput) {
        contentPathInput.value = params.path;
      }
    }


    if (params.maxResults) {
      const maxResultsInput = document.getElementById('max-results');
      if (maxResultsInput) {
        maxResultsInput.value = params.maxResults;
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
        performAEMScan();
      }, 1000);
    }

    showNotification('Configuration loaded from URL parameters', 'info');


    if (configSection && configToggleBtn) {
      configSection.classList.add('collapsed');
      configToggleBtn.classList.add('collapsed');
    }
  } catch (error) {
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
        await storage.save(oldData);
        showNotification(`Migrated ${oldData.length} items to 'legacy-data' site`, 'success');
      }
    }

    await storage.clear();
    await loadAvailableSites();
    showNotification('Old data cleared successfully', 'success');
  } catch (error) {
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
