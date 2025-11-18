import { waitForMediaLibraryReady, createStorage } from '../../dist/media-library.es.js';
import { EDSSource } from '../../sources/index.js';

let mediaLibrary;

function setupControls() {
  const siteSelector = document.getElementById('site-selector');
  const scanBtn = document.getElementById('scan-btn');
  const clearBtn = document.getElementById('clear-btn');
  const deleteSiteBtn = document.getElementById('delete-site-btn');

  // Load available sites on initialization
  // eslint-disable-next-line no-use-before-define
  loadAvailableSites();

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
    performEDSScan();
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
          const storage = createStorage('indexeddb');
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
performEDSScan() {
  const edsOrg = document.getElementById('eds-org').value.trim();
  const edsRepo = document.getElementById('eds-repo').value.trim();

  if (!edsOrg || !edsRepo) {
    // eslint-disable-next-line no-use-before-define
    showNotification('Please enter both Organization and Repository', 'error');
    return;
  }

  try {
    const scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';

    const dataSource = new EDSSource();
    const options = {
      org: edsOrg,
      repo: edsRepo,
      maxResults: 1000,
      requireAuth: true,
    };

    const pageList = await dataSource.getPageList(null, options);
    const siteKey = `${edsOrg}-${edsRepo}`;

    await mediaLibrary.clearData();
    const mediaData = await mediaLibrary.loadFromPageList(pageList, null, siteKey);

    // eslint-disable-next-line no-use-before-define
    showNotification(`Scan complete! Found ${mediaData.length} media items`, 'success');
    // eslint-disable-next-line no-use-before-define
    loadAvailableSites();
  } catch (error) {
    // Log detailed error to console
    // eslint-disable-next-line no-console
    console.error('EDS scan failed:', error);
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
    scanBtn.textContent = 'Scan EDS Site';
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
    if (params.org) {
      const edsOrgInput = document.getElementById('eds-org');
      if (edsOrgInput) {
        edsOrgInput.value = params.org;
      }
    }

    if (params.repo) {
      const edsRepoInput = document.getElementById('eds-repo');
      if (edsRepoInput) {
        edsRepoInput.value = params.repo;
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
        performEDSScan();
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
