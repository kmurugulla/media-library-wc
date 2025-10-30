// workers/ai-agent-worker/html-context.js
// HTML parsing and context extraction utilities

export function getSurroundingText(element, maxLength = 200) {
  if (!element || !element.parentNode) return '';

  const parent = element.parentNode;
  const text = parent.text || '';
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.substring(0, maxLength)}...`;
}

export function getNearestHeading(element) {
  if (!element) return null;

  let current = element;
  while (current) {
    const headings = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

    for (const tag of headings) {
      const heading = current.querySelector(tag);
      if (heading) {
        return { tag, text: heading.text };
      }
    }

    current = current.parentNode;
    if (!current || current.tagName === 'BODY') break;
  }

  return null;
}

export function getSectionContext(element) {
  if (!element) return 'unknown';

  let current = element;
  while (current && current.tagName !== 'BODY') {
    const classList = current.classNames || [];
    const classes = Array.isArray(classList) ? classList.join(' ') : String(classList);

    if (classes.includes('hero')) return 'hero';
    if (classes.includes('header')) return 'header';
    if (classes.includes('footer')) return 'footer';
    if (classes.includes('sidebar')) return 'sidebar';
    if (classes.includes('nav')) return 'navigation';

    if (current.tagName === 'HEADER') return 'header';
    if (current.tagName === 'FOOTER') return 'footer';
    if (current.tagName === 'NAV') return 'navigation';
    if (current.tagName === 'ASIDE') return 'sidebar';
    if (current.tagName === 'MAIN') return 'main-content';

    current = current.parentNode;
  }

  return 'body';
}
