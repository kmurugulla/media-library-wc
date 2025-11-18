const SELECTORS = {
  MEDIA_LIBRARY: '#media-library',
  WEBSITE_URL: '#website-url',
  SCAN_BUTTON: '#scan-btn',
  CLEAR_BUTTON: '#clear-btn',
  DELETE_SITE_BUTTON: '#delete-site-btn',
  SITE_SELECTOR: '#site-selector',
  INCLUDE_POSTS: '#include-posts',
  INCLUDE_PAGES: '#include-pages',
  INCLUDE_MEDIA: '#include-media',
  CONFIG_TOGGLE_BUTTON: '#config-toggle-btn',
  CONFIG_SECTION: '#config-section',
};

const domCache = {
  mediaLibrary: null,
  websiteUrl: null,
  scanButton: null,
  clearButton: null,
  deleteSiteButton: null,
  siteSelector: null,
  includePosts: null,
  includePages: null,
  includeMedia: null,
  configToggleButton: null,
  configSection: null,

  init() {
    this.mediaLibrary = document.querySelector(SELECTORS.MEDIA_LIBRARY);
    this.websiteUrl = document.querySelector(SELECTORS.WEBSITE_URL);
    this.scanButton = document.querySelector(SELECTORS.SCAN_BUTTON);
    this.clearButton = document.querySelector(SELECTORS.CLEAR_BUTTON);
    this.deleteSiteButton = document.querySelector(SELECTORS.DELETE_SITE_BUTTON);
    this.siteSelector = document.querySelector(SELECTORS.SITE_SELECTOR);
    this.includePosts = document.querySelector(SELECTORS.INCLUDE_POSTS);
    this.includePages = document.querySelector(SELECTORS.INCLUDE_PAGES);
    this.includeMedia = document.querySelector(SELECTORS.INCLUDE_MEDIA);
    this.configToggleButton = document.querySelector(SELECTORS.CONFIG_TOGGLE_BUTTON);
    this.configSection = document.querySelector(SELECTORS.CONFIG_SECTION);
  },
};

export default domCache;
