import CONFIG from './constants.js';

export async function withTimeout(promise, timeoutMs = CONFIG.DEFAULT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    }),
  ]);
}

export async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }
  return null; // This should never be reached, but satisfies consistent-return
}

export async function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export async function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function createAbortController() {
  return new AbortController();
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.DEFAULT_TIMEOUT) {
  const controller = createAbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

export async function waitForElement(selector, timeoutMs = CONFIG.DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

export async function waitForEvent(element, eventName, timeoutMs = CONFIG.DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      element.removeEventListener(eventName, handler);
      reject(new Error(`Event ${eventName} not fired within ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (event) => {
      clearTimeout(timeoutId);
      element.removeEventListener(eventName, handler);
      resolve(event);
    };

    element.addEventListener(eventName, handler);
  });
}
