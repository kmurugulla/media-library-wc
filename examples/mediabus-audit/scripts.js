import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';
import MediaBusAuditSource from '../../sources/mediabus-audit.js';

const mediaLibrary = document.getElementById('media-library');

function showNotification(heading, message, type = 'info') {
  window.dispatchEvent(new CustomEvent('show-notification', {
    detail: {
      heading,
      message,
      type,
      open: true,
    },
  }));
}

document.getElementById('load-audit-logs').addEventListener('click', async () => {
  const org = document.getElementById('org-name').value;
  const repo = document.getElementById('repo-name').value;
  const mediaBaseUrl = document.getElementById('media-base-url').value;
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const operationFilter = document.getElementById('operation-filter').value;
  const limit = parseInt(document.getElementById('limit').value, 10);

  if (!org || !repo) {
    // eslint-disable-next-line no-alert
    alert('Please enter both organization and site names');
    return;
  }

  const loadButton = document.getElementById('load-audit-logs');
  const originalText = loadButton.textContent;

  try {
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';

    await mediaLibrary.clearData();

    const auditSource = new MediaBusAuditSource();

    const mediaData = await auditSource.getMediaData(null, {
      org,
      repo,
      mediaBaseUrl,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      operation: operationFilter,
      limit,
      requireAuth: true,
    });

    const siteKey = `audit-${org}-${repo}`;
    const useStorage = document.getElementById('use-storage').checked;

    await mediaLibrary.loadMediaData(mediaData, siteKey, useStorage);

    const storageStatus = useStorage ? ' (saved to storage)' : ' (not saved)';
    showNotification('Success', `Loaded ${mediaData.length} media items from Media-Bus audit logs${storageStatus}`, 'success');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load audit logs:', error);
    showNotification('Error', `Failed to load audit logs: ${error.message}`, 'error');
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = originalText;
  }
});

const today = new Date();
const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

const [todayStr] = today.toISOString().split('T');
const [thirtyDaysAgoStr] = thirtyDaysAgo.toISOString().split('T');

document.getElementById('end-date').value = todayStr;
document.getElementById('start-date').value = thirtyDaysAgoStr;

document.getElementById('org-name').placeholder = 'adobe';
document.getElementById('repo-name').placeholder = 'theblog';

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    const loadButton = document.getElementById('load-audit-logs');
    loadButton.click();
  }
});

function validateForm() {
  const org = document.getElementById('org-name').value;
  const repo = document.getElementById('repo-name').value;
  const mediaBaseUrl = document.getElementById('media-base-url').value;

  const errors = [];

  if (!org.trim()) {
    errors.push('Organization name is required');
  }

  if (!repo.trim()) {
    errors.push('Site name is required');
  }

  if (!mediaBaseUrl.trim()) {
    errors.push('Media base URL is required');
  } else {
    try {
      // eslint-disable-next-line no-new
      new URL(mediaBaseUrl);
    } catch {
      errors.push('Media base URL must be a valid URL');
    }
  }

  return errors;
}

function updateValidation() {
  const errors = validateForm();
  const loadButton = document.getElementById('load-audit-logs');

  if (errors.length > 0) {
    loadButton.disabled = true;
    loadButton.title = errors.join(', ');
  } else {
    loadButton.disabled = false;
    loadButton.title = 'Load audit logs from Media-Bus';
  }
}

document.getElementById('org-name').addEventListener('input', updateValidation);
document.getElementById('repo-name').addEventListener('input', updateValidation);
document.getElementById('media-base-url').addEventListener('input', updateValidation);

updateValidation();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForMediaLibraryReady(mediaLibrary);
    showNotification('Success', 'Media library initialized successfully', 'success');
  } catch (error) {
    showNotification('Error', `Failed to initialize media library: ${error.message}`, 'error');
  }
});
