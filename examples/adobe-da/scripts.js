import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';
import { AdobeDASource } from '../../sources/index.js';

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
      // eslint-disable-next-line no-use-before-define
    // eslint-disable-next-line no-use-before-define
      showNotification('Switched to IndexDB storage - future scans will be saved', 'info');
    } else if (previousStorage !== 'r2' && newStorage === 'r2') {
      // eslint-disable-next-line no-use-before-define
      // eslint-disable-next-line no-use-before-define
      showNotification('Switched to R2 storage - future scans will be saved to cloud', 'info');
    }

    // eslint-disable-next-line no-use-before-define
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
      clearStorageBtn.style.display = 'none';
    } else {
      await mediaLibrary.clearData();
      // Hide Clear Data button and show Clear All Storage button when no site is selected
      deleteSiteBtn.style.display = 'none';
      clearStorageBtn.style.display = 'inline-block';
    }
  });

  scanBtn.addEventListener('click', async () => {
    await // eslint-disable-next-line no-use-before-define
    performAdobeDAScan();
  });

  authBtn.addEventListener('click', async () => {
    await // eslint-disable-next-line no-use-before-define
    performAuthentication();
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

  // eslint-disable-next-line no-use-before-define
  loadAvailableSites();
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

async function // eslint-disable-next-line no-use-before-define
performAdobeDAScan() {
  const adobeOrg = document.getElementById('adobe-org').value.trim();
  const adobeRepo = document.getElementById('adobe-repo').value.trim();

  if (!adobeOrg || !adobeRepo) {
    // eslint-disable-next-line no-use-before-define
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

    // eslint-disable-next-line no-use-before-define
    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    // eslint-disable-next-line no-use-before-define
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
    });

    // Show generic error message to user
    // eslint-disable-next-line no-use-before-define
    showNotification('Scan failed: Check console for detailed error information', 'error');
  } finally {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan Adobe DA Assets';
  }
}

async function // eslint-disable-next-line no-use-before-define
performAuthentication() {
  try {
    const authBtn = document.getElementById('auth-btn');
    authBtn.disabled = true;
    authBtn.textContent = 'Authenticating...';

    if (window.adobeIMS) {
      const token = window.adobeIMS.getAccessToken();
      if (token) {
        localStorage.setItem('nx-ims', 'true');
        // eslint-disable-next-line no-use-before-define
        showNotification('Already authenticated with Adobe IMS', 'success');
      } else {
        window.adobeIMS.signIn();
        // eslint-disable-next-line no-use-before-define
        showNotification('Please complete authentication in the popup window', 'info');
      }
    } else {
      await // eslint-disable-next-line no-use-before-define
      loadIMSLibrary();
      // eslint-disable-next-line no-use-before-define
      showNotification('IMS library loaded. Please try authenticating again.', 'info');
    }
  } catch (error) {
    // eslint-disable-next-line no-use-before-define
    showNotification(`Authentication failed: ${error.message}`, 'error');

    // eslint-disable-next-line no-console
    console.error('Authentication error:', error);
  } finally {
    const authBtn = document.getElementById('auth-btn');
    authBtn.disabled = false;
    authBtn.textContent = 'Authenticate';
  }
}

async function // eslint-disable-next-line no-use-before-define
loadIMSLibrary() {
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

async function // eslint-disable-next-line no-use-before-define
loadAvailableSites() {
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
    } else if (currentSelection && sites.some((site) => site.siteKey === currentSelection)) {
      // Restore selection if it was valid
      siteSelector.value = currentSelection;
      // Show Clear Data button and hide Clear All Storage button when site is selected
      deleteSiteBtn.style.display = 'inline-block';
      clearStorageBtn.style.display = 'none';
    } else {
      // No valid selection, hide both buttons (Clear All should never show)
      clearStorageBtn.style.display = 'none';
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
        performAdobeDAScan();
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

window.clearOldData = async () => {
  try {
    const storage = mediaLibrary.storageManager;

    if (!storage) {
      // eslint-disable-next-line no-use-before-define
      showNotification('Storage manager not available', 'error');
      return;
    }

    const oldData = await storage.load('media-data');
    if (oldData && oldData.length > 0) {
      // eslint-disable-next-line no-alert, no-restricted-globals
      const shouldMigrate = confirm(`Found ${oldData.length} items in old format. Would you like to migrate them to 'legacy-data' site before clearing?`);
      if (shouldMigrate) {
        await storage.save(oldData);
        // eslint-disable-next-line no-use-before-define
        showNotification(`Migrated ${oldData.length} items to 'legacy-data' site`, 'success');
      }
    }

    // Use clearAllSites() instead of the non-existent clear() method
    await storage.clearAllSites();
    await // eslint-disable-next-line no-use-before-define
    loadAvailableSites();
    // eslint-disable-next-line no-use-before-define
    showNotification('Old data cleared successfully', 'success');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear old data:', error);
    // eslint-disable-next-line no-use-before-define
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
