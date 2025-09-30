/* examples/custom-cors-proxy/scripts.js */
import { waitForMediaLibraryReady } from '../../dist/media-library.es.js';
import { SitemapSource } from '../../sources/index.js';
import { createStorage } from '../../src/utils/storage.js';

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

async function performSitemapScan() {
  const websiteUrl = 'https://example.com'; // Example website
  const sitemapUrl = 'https://example.com/sitemap.xml'; // Example sitemap

  try {
    // Use the CORS proxy configured in the media library component
    const corsProxyUrl = mediaLibrary.corsProxy;
    // eslint-disable-next-line no-console
    console.log('Using CORS proxy:', corsProxyUrl);

    const source = new SitemapSource({
      corsProxy: corsProxyUrl,
      useCorsProxy: true,
    });

    showNotification('Starting scan with custom CORS proxy...', 'info');

    const pageList = await source.getPageList(websiteUrl, sitemapUrl);

    if (!pageList || pageList.length === 0) {
      showNotification('No pages found in sitemap', 'error');
      return;
    }

    // Limit to first 5 pages for demo
    const limitedPageList = pageList.slice(0, 5);

    const siteKey = new URL(websiteUrl).hostname;

    // Initialize media library
    mediaLibrary.storage = 'indexeddb';
    await mediaLibrary.initialize();

    const siteStorageManager = createStorage('indexeddb', siteKey);
    mediaLibrary.storageManager = siteStorageManager;

    const existingMediaData = await siteStorageManager.load();
    const previousMetadata = await siteStorageManager.loadScanMetadata();

    const changedPages = previousMetadata
      ? source.filterChangedUrls(limitedPageList, previousMetadata)
      : limitedPageList;

    if (changedPages.length === 0) {
      showNotification('No changes detected - scan not needed', 'info');
      return;
    }

    const mediaData = await mediaLibrary.loadFromPageList(
      changedPages,
      null,
      siteKey,
      true,
      previousMetadata,
      limitedPageList,
      existingMediaData,
    );

    showNotification(`Scan complete! Found ${mediaData.length} media files using custom CORS proxy.`, 'success');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Sitemap scan failed:', error);
    showNotification(`Scan failed: ${error.message}`, 'error');
  }
}

function setupControls() {
  const corsProxyInput = document.getElementById('cors-proxy-url');
  const applyConfigBtn = document.getElementById('apply-config');

  // Set the input to show the current CORS proxy value
  corsProxyInput.value = mediaLibrary.corsProxy;

  applyConfigBtn.addEventListener('click', () => {
    const newCorsProxy = corsProxyInput.value.trim();

    if (!newCorsProxy) {
      showNotification('Please enter a CORS proxy URL', 'error');
      return;
    }

    // Method 1: Update the media library component's CORS proxy property
    // This will now trigger the updated() lifecycle method automatically
    mediaLibrary.corsProxy = newCorsProxy;

    // Method 2: Update the content parser directly (alternative approach)
    // This is now handled automatically by the updated() method, but we can still do it manually
    if (mediaLibrary.contentParser) {
      mediaLibrary.contentParser.corsProxy = newCorsProxy;
    }

    showNotification(`CORS proxy updated to: ${newCorsProxy}`, 'success');
    // eslint-disable-next-line no-console
    console.log('CORS proxy updated:', newCorsProxy);

    // Verify the ContentParser was updated automatically
    // eslint-disable-next-line no-console
    console.log('ContentParser CORS proxy:', mediaLibrary.contentParser.corsProxy);
  });

  // Test the CORS proxy configuration
  const testBtn = document.createElement('button');
  testBtn.textContent = 'Test CORS Proxy';
  testBtn.style.marginLeft = '10px';
  testBtn.addEventListener('click', async () => {
    try {
      const corsProxyUrl = mediaLibrary.corsProxy;
      const testUrl = `${corsProxyUrl}?url=${encodeURIComponent('https://httpbin.org/json')}`;

      showNotification('Testing CORS proxy...', 'info');

      const response = await fetch(testUrl);
      if (response.ok) {
        showNotification('CORS proxy test successful!', 'success');
      } else {
        showNotification(`CORS proxy test failed: ${response.status}`, 'error');
      }
    } catch (error) {
      showNotification(`CORS proxy test failed: ${error.message}`, 'error');
    }
  });

  applyConfigBtn.parentNode.appendChild(testBtn);
}

function demonstrateAllMethods() {
  // eslint-disable-next-line no-console
  console.log('=== CORS Proxy Configuration Methods ===');

  // Method 1: HTML Attribute (already set in HTML)
  // eslint-disable-next-line no-console
  console.log('Method 1 - HTML Attribute:', mediaLibrary.corsProxy);

  // Method 2: JavaScript Property (dynamic)
  // eslint-disable-next-line no-console
  console.log('Method 2 - JavaScript Property: mediaLibrary.corsProxy = "new-url"');

  // Method 3: Constructor (programmatic creation)
  // eslint-disable-next-line no-console
  console.log('Method 3 - Constructor: MediaLibrary.create({ corsProxy: "url" })');

  // Show current value
  // eslint-disable-next-line no-console
  console.log('Current CORS proxy value:', mediaLibrary.corsProxy);
}

function setupNotifications() {
  window.addEventListener('show-notification', (e) => {
    const { heading, message, type } = e.detail;
    showNotification(`${heading}: ${message}`, type);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  mediaLibrary = document.getElementById('media-library');

  await waitForMediaLibraryReady(mediaLibrary);

  setupControls();
  setupNotifications();

  // Show initial configuration
  showNotification(`Current CORS proxy: ${mediaLibrary.corsProxy}`, 'info');

  // Demonstrate all three methods
  demonstrateAllMethods();

  // Auto-start a demo scan
  setTimeout(() => {
    performSitemapScan();
  }, 2000);
});
