export function domEl(tag, ...items) {
  const element = document.createElement(tag);

  if (!items || items.length === 0) return element;

  let processedItems = items;
  if (!(items[0] instanceof Element) && typeof items[0] === 'object') {
    const [attributes, ...rest] = items;
    processedItems = rest;

    Object.entries(attributes).forEach(([key, value]) => {
      if (!key.startsWith('on')) {
        element.setAttribute(key, Array.isArray(value) ? value.join(' ') : value);
      } else {
        element.addEventListener(key.substring(2).toLowerCase(), value);
      }
    });
  }

  processedItems.forEach((item) => {
    element.appendChild(item instanceof Element ? item : document.createTextNode(item));
  });

  return element;
}

export const div = (...items) => domEl('div', ...items);
export const button = (...items) => domEl('button', ...items);
export const input = (...items) => domEl('input', ...items);
export const select = (...items) => domEl('select', ...items);
export const option = (...items) => domEl('option', ...items);
export const span = (...items) => domEl('span', ...items);
export const p = (...items) => domEl('p', ...items);
export const h1 = (...items) => domEl('h1', ...items);
export const h2 = (...items) => domEl('h2', ...items);
export const h3 = (...items) => domEl('h3', ...items);
export const label = (...items) => domEl('label', ...items);
export const form = (...items) => domEl('form', ...items);
export const fieldset = (...items) => domEl('fieldset', ...items);
export const legend = (...items) => domEl('legend', ...items);
export const section = (...items) => domEl('section', ...items);
export const article = (...items) => domEl('article', ...items);
export const nav = (...items) => domEl('nav', ...items);
export const ul = (...items) => domEl('ul', ...items);
export const li = (...items) => domEl('li', ...items);
export const a = (...items) => domEl('a', ...items);
export const img = (...items) => domEl('img', ...items);
export const svg = (...items) => domEl('svg', ...items);
export const use = (...items) => domEl('use', ...items);
export const strong = (...items) => domEl('strong', ...items);
export const em = (...items) => domEl('em', ...items);
export const br = (...items) => domEl('br', ...items);
export const hr = (...items) => domEl('hr', ...items);
