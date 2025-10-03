import domCache from './dom-cache.js';
import { showNotification } from './error-handler.js';
import { withTimeout } from './async-utils.js';

export class ComponentManager {
  constructor() {
    this.components = new Map();
    this.initialized = false;
  }

  register(name, component) {
    this.components.set(name, component);
  }

  get(name) {
    return this.components.get(name);
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.initializeComponents();
      this.initialized = true;
    } catch (error) {
      showNotification(`Failed to initialize components: ${error.message}`, 'error');
      throw error;
    }
  }

  async initializeComponents() {
    const initPromises = Array.from(this.components.values()).map((component) => {
      if (typeof component.initialize === 'function') {
        return withTimeout(component.initialize(), 5000);
      }
      return Promise.resolve();
    });

    await Promise.all(initPromises);
  }

  async destroy() {
    const destroyPromises = Array.from(this.components.values()).map((component) => {
      if (typeof component.destroy === 'function') {
        return component.destroy();
      }
      return Promise.resolve();
    });

    await Promise.all(destroyPromises);
    this.components.clear();
    this.initialized = false;
  }
}

export class BaseComponent {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.element = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    this.element = this.getElement();
    if (this.element) {
      await this.setup();
      this.initialized = true;
    }
  }

  getElement() {
    return domCache[this.name] || document.querySelector(`#${this.name}`);
  }

  async setup() {
    // Override in subclasses
  }

  async destroy() {
    this.initialized = false;
    this.element = null;
  }

  show() {
    if (this.element) {
      this.element.style.display = 'block';
    }
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  enable() {
    if (this.element) {
      this.element.disabled = false;
    }
  }

  disable() {
    if (this.element) {
      this.element.disabled = true;
    }
  }
}

export class FormComponent extends BaseComponent {
  constructor(name, options = {}) {
    super(name, options);
    this.validators = new Map();
  }

  addValidator(field, validator) {
    this.validators.set(field, validator);
  }

  validate() {
    const errors = [];

    for (const [field, validator] of this.validators) {
      const value = this.getValue(field);
      try {
        validator(value);
      } catch (error) {
        errors.push({ field, message: error.message });
      }
    }

    return errors;
  }

  getValue(field) {
    const element = this.element?.querySelector(`[name="${field}"]`);
    if (!element) return null;

    if (element.type === 'checkbox') {
      return element.checked;
    }

    return element.value;
  }

  setValue(field, value) {
    const element = this.element?.querySelector(`[name="${field}"]`);
    if (!element) return;

    if (element.type === 'checkbox') {
      element.checked = value;
    } else {
      element.value = value;
    }
  }

  reset() {
    if (this.element) {
      this.element.reset();
    }
  }
}

export class NotificationComponent extends BaseComponent {
  constructor(name = 'notification', options = {}) {
    super(name, options);
    this.notifications = new Map();
  }

  show(message, type = 'info', duration = 3000) {
    const id = Date.now().toString();
    const notification = this.createNotification(message, type, id);

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    const timeoutId = setTimeout(() => {
      this.hide(id);
    }, duration);

    this.notifications.set(id, { element: notification, timeoutId });

    return id;
  }

  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    clearTimeout(notification.timeoutId);
    notification.element.classList.remove('show');

    notification.element.addEventListener('transitionend', () => {
      if (document.body.contains(notification.element)) {
        document.body.removeChild(notification.element);
      }
      this.notifications.delete(id);
    });
  }

  createNotification(message, type, id) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.dataset.id = id;

    notification.addEventListener('click', () => {
      this.hide(id);
    });

    return notification;
  }
}

export const componentManager = new ComponentManager();
