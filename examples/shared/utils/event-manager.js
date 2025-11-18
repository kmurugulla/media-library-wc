import CONFIG from './constants.js';
import domCache from './dom-cache.js';
import { getFormData, validateFormData } from './form-utils.js';
import { showNotification, handleError } from './error-handler.js';

let mediaLibrary;
let performWordPressScan;

export function setupEventDelegation() {
  document.addEventListener('click', (event) => {
    const { target } = event;

    if (target.matches('#scan-btn')) {
      handleScanClick();
    } else if (target.matches('#clear-btn')) {
      handleClearClick();
    } else if (target.matches('#delete-site-btn')) {
      handleDeleteSiteClick();
    } else if (target.matches('#config-toggle-btn')) {
      handleConfigToggleClick();
    }
  });

  document.addEventListener('change', (event) => {
    const { target } = event;

    if (target.matches('#site-selector')) {
      handleSiteSelectorChange();
    }
  });

  document.addEventListener('show-notification', (event) => {
    const { heading, message, type } = event.detail;
    createNotification(`${heading}: ${message}`, type);
  });
}

function handleScanClick() {
  if (mediaLibrary && performWordPressScan) {
    performWordPressScan();
  }
}

function handleClearClick() {
  if (mediaLibrary) {
    mediaLibrary.clearData();
  }
}

function handleDeleteSiteClick() {
  if (mediaLibrary && domCache.siteSelector?.value) {
    const selectedSite = domCache.siteSelector.value;
    const confirmed = confirm(`Are you sure you want to delete all data for "${selectedSite}"? This action cannot be undone.`);

    if (confirmed) {
      deleteSiteData(selectedSite);
    }
  }
}

function handleConfigToggleClick() {
  if (domCache.configSection && domCache.configToggleButton) {
    const isCollapsed = domCache.configSection.classList.contains('collapsed');
    if (isCollapsed) {
      domCache.configSection.classList.remove('collapsed');
      domCache.configToggleButton.classList.remove('collapsed');
    } else {
      domCache.configSection.classList.add('collapsed');
      domCache.configToggleButton.classList.add('collapsed');
    }
  }
}

function handleSiteSelectorChange() {
  if (mediaLibrary && domCache.siteSelector) {
    const selectedSite = domCache.siteSelector.value;
    if (selectedSite) {
      mediaLibrary.loadFromStorage(selectedSite);
      createNotification(`Loaded data for site: ${selectedSite}`, 'success');
      domCache.deleteSiteButton.style.display = 'inline-block';
    } else {
      mediaLibrary.clearData();
      domCache.deleteSiteButton.style.display = 'none';
    }
  }
}

function createNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  requestAnimationFrame(() => {
    notification.classList.add('show');
  });

  const removeNotification = () => {
    notification.classList.remove('show');
    notification.addEventListener('transitionend', () => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    });
  };

  const timeoutId = setTimeout(removeNotification, CONFIG.NOTIFICATION_DURATION);
  notification.addEventListener('click', () => {
    clearTimeout(timeoutId);
    removeNotification();
  });
}

export function setMediaLibrary(ml) {
  mediaLibrary = ml;
}

export function setPerformWordPressScan(fn) {
  performWordPressScan = fn;
}

export { createNotification };
