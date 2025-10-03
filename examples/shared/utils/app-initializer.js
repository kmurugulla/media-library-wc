import domCache from './dom-cache.js';
import { setupEventDelegation, setMediaLibrary, setPerformWordPressScan } from './event-manager.js';
import { applyURLParameters } from './url-utils.js';
import { showNotification, handleError } from './error-handler.js';
import { componentManager } from './component-manager.js';

export class AppInitializer {
  constructor() {
    this.initialized = false;
    this.mediaLibrary = null;
    this.performWordPressScan = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.setupDOM();
      await this.setupComponents();
      await this.setupEventHandlers();
      await this.applyURLParameters();

      this.initialized = true;
      showNotification('Application initialized successfully', 'success');
    } catch (error) {
      handleError(error, 'Failed to initialize application');
      throw error;
    }
  }

  async setupDOM() {
    domCache.init();

    if (!domCache.mediaLibrary) {
      throw new Error('Media library element not found');
    }
  }

  async setupComponents() {
    await componentManager.initialize();
  }

  async setupEventHandlers() {
    setupEventDelegation();
  }

  async applyURLParameters() {
    applyURLParameters();
  }

  setMediaLibrary(ml) {
    this.mediaLibrary = ml;
    setMediaLibrary(ml);
  }

  setPerformWordPressScan(fn) {
    this.performWordPressScan = fn;
    setPerformWordPressScan(fn);
  }

  async destroy() {
    if (!this.initialized) return;

    try {
      await componentManager.destroy();
      this.initialized = false;
    } catch (error) {
      handleError(error, 'Failed to destroy application');
    }
  }
}

export const appInitializer = new AppInitializer();

export async function initializeApp(mediaLibrary, performWordPressScan) {
  appInitializer.setMediaLibrary(mediaLibrary);
  appInitializer.setPerformWordPressScan(performWordPressScan);
  await appInitializer.initialize();
}

export async function destroyApp() {
  await appInitializer.destroy();
}
