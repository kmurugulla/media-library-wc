// src/utils/getSvg.js
const PARSER = new DOMParser();

async function fetchIcon(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) {
      return null;
    }
    const text = await resp.text();
    
    const doc = PARSER.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    return svg;
  } catch (error) {
    return null;
  }
}

export default async function getSvg({ parent, paths }) {
  const svgs = await Promise.all(paths.map(async (path) => {
    const svg = await fetchIcon(path);
    if (svg && parent) {
      const filename = path.split('/').pop().replace('.svg', '');
      svg.id = filename;
      
      const existingIdElement = svg.querySelector(`#${filename}`);
      if (existingIdElement) {
        existingIdElement.id = filename;
      }
      
      parent.append(svg);
    }
    return svg;
  }));
  
  return svgs;
}
