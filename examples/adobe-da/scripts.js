
import '../../dist/media-library.es.js';
import { AdobeDASource } from '../../sources/index.js';
import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';

let mediaLibrary;

function setupControls() {
  const storageSelect = document.getElementById('storage-type');
  const localeSelect = document.getElementById('locale');
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const authBtn = document.getElementById('auth-btn');
  const clearBtn = document.getElementById('clear-btn');
  const deleteSiteBtn = document.getElementById('delete-site-btn');
  const clearStorageBtn = document.getElementById('clear-storage-btn');

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
      // Show Clear Data button and hide Clear All Storage button when site is selected
      deleteSiteBtn.style.display = 'inline-block';
      clearStorageBtn.style.display = 'none';
    } else {
      await mediaLibrary.clearData();
      // Hide Clear Data button and show Clear All Storage button when no site is selected
      deleteSiteBtn.style.display = 'none';
      clearStorageBtn.style.display = 'inline-block';
    }
  });


  scanBtn.addEventListener('click', async () => {
    await performAdobeDAScan();
  });


  authBtn.addEventListener('click', async () => {
    await performAuthentication();
  });


  clearBtn.addEventListener('click', () => {
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
          
          showNotification(`Deleted data for site: ${selectedSite}`, 'success');

          // Clear the current display if the deleted site was loaded
          await mediaLibrary.clearData();

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

async function performAdobeDAScan() {
  const adobeOrg = document.getElementById('adobe-org').value.trim();
  const adobeRepo = document.getElementById('adobe-repo').value.trim();

  if (!adobeOrg || !adobeRepo) {
    showNotification('Please enter both Organization and Repository', 'error');
    return;
  }

  try {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';


    const dataSource = new AdobeDASource();
    const options = {
      org: adobeOrg,
      repo: adobeRepo,
      maxResults: 1000,
      requireAuth: true,
    };

    const pageList = await dataSource.getPageList(null, options);
    const siteKey = `${adobeOrg}-${adobeRepo}`;

    await mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    loadAvailableSites();
  } catch (error) {
    // Log detailed error to console
    // eslint-disable-next-line no-console
    console.error('Adobe DA scan failed:', error);
    // eslint-disable-next-line no-console
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      org,
      repo,
      maxResults,
    });

    // Show generic error message to user
    showNotification('Scan failed: Check console for detailed error information', 'error');
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan Adobe DA Assets';
  }
}

async function performAuthentication() {
  try {
    const authBtn = document.getElementById('auth-btn');
    authBtn.disabled = true;
    authBtn.textContent = 'Authenticating...';


    if (window.adobeIMS) {
  
      const token = window.adobeIMS.getAccessToken();
      if (token) {
        localStorage.setItem('nx-ims', 'true');
        showNotification('Already authenticated with Adobe IMS', 'success');
      } else {
    
        window.adobeIMS.signIn();
        showNotification('Please complete authentication in the popup window', 'info');
      }
    } else {
  
      await loadIMSLibrary();
      showNotification('IMS library loaded. Please try authenticating again.', 'info');
    }
  } catch (error) {
    showNotification(`Authentication failed: ${error.message}`, 'error');
    
    console.error('Authentication error:', error);
  } finally {
    const authBtn = document.getElementById('auth-btn');
    authBtn.disabled = false;
    authBtn.textContent = 'Authenticate';
  }
}

async function loadIMSLibrary() {
  return new Promise((resolve, reject) => {
    if (window.adobeIMS) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://auth.services.adobe.com/imslib/imslib.min.js';
    script.onload = () => {
  
      window.adobeid = {
        client_id: 'your-client-id',
        scope: 'AdobeID,openid,gnav',
        locale: 'en_US',
        autoValidateToken: true,
        environment: 'prod',
        useLocalStorage: true,
        onReady: () => {
          const token = window.adobeIMS.getAccessToken();
          if (token) {
            localStorage.setItem('nx-ims', 'true');
          }
          resolve();
        },
        onError: reject,
      };
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadAvailableSites() {
  try {
    const storageType = document.getElementById('storage-type').value || 'indexeddb';
    const storage = createStorage(storageType);

    const sites = await storage.getAllSites();

    const siteSelector = document.getElementById('site-selector');
    const deleteSiteBtn = document.getElementById('delete-site-btn');
    const clearStorageBtn = document.getElementById('clear-storage-btn');

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
      clearStorageBtn.style.display = 'none';
    } else {
      // Restore selection if it was valid
      if (currentSelection && sites.some(site => site.siteKey === currentSelection)) {
        siteSelector.value = currentSelection;
        // Show Clear Data button and hide Clear All Storage button when site is selected
        deleteSiteBtn.style.display = 'inline-block';
        clearStorageBtn.style.display = 'none';
      } else {
        // No valid selection, hide both buttons (Clear All should never show)
        clearStorageBtn.style.display = 'none';
        deleteSiteBtn.style.display = 'none';
      }
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
        performAdobeDAScan();
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
        await storage.save(oldData);
        showNotification(`Migrated ${oldData.length} items to 'legacy-data' site`, 'success');
      }
    }

    // Use clearAllSites() instead of the non-existent clear() method
    await storage.clearAllSites();
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
