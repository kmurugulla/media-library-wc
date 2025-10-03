import CONFIG from './constants.js';

export function handleError(error, context = '') {
  const message = error.message || 'Unknown error occurred';
  // eslint-disable-next-line no-console
  console.error(`${context}: ${message}`, error);

  showNotification(`Error: ${message}`, CONFIG.NOTIFICATION_TYPES.ERROR);
}

export function showNotification(message, type = CONFIG.NOTIFICATION_TYPES.INFO) {
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

export function createErrorNotification(message) {
  return showNotification(message, CONFIG.NOTIFICATION_TYPES.ERROR);
}

export function createSuccessNotification(message) {
  return showNotification(message, CONFIG.NOTIFICATION_TYPES.SUCCESS);
}

export function createInfoNotification(message) {
  return showNotification(message, CONFIG.NOTIFICATION_TYPES.INFO);
}
