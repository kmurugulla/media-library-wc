import { build } from 'vite';
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { join } from 'path';

// This function only copies assets - the main build is handled by vite build command

// Copy icons to dist
const distDir = 'dist';
const iconsDir = join(distDir, 'icons');

if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir);
}

// Copy all icons
const icons = [
  'close.svg', 'photo.svg', 'video.svg', 'pdf.svg', 
  'external-link.svg', 'copy.svg', 'search.svg', 
  'list.svg', 'grid.svg', 'refresh.svg', 'eye.svg', 'link.svg'
];

icons.forEach(icon => {
  const srcPath = join('src', 'icons', icon);
  const destPath = join(iconsDir, icon);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`Copied ${icon}`);
  }
});

// Copy locales
const localesDir = join(distDir, 'locales');
if (!existsSync(localesDir)) {
  mkdirSync(localesDir);
}

const locales = ['en.json', 'es.json', 'de.json', 'fr.json'];
locales.forEach(locale => {
  const srcPath = join('src', 'locales', locale);
  const destPath = join(localesDir, locale);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`Copied ${locale}`);
  }
});

// Copy data directory (category patterns)
const dataDir = join(distDir, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir);
}

const dataFiles = ['category-patterns.json'];
dataFiles.forEach(dataFile => {
  const srcPath = join('src', 'data', dataFile);
  const destPath = join(dataDir, dataFile);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`Copied ${dataFile}`);
  }
});

// Note: Sources and utils are NOT copied to dist
// Sources should be provided by the host system
// Utils are bundled into the main media-library.es.js file

// Examples are kept at root level for development
// They are not copied to dist as dist only contains core WC files

// Fix asset paths in the built JavaScript file
import { readFileSync, writeFileSync } from 'fs';

const jsFile = join(distDir, 'media-library-full.iife.js');
if (existsSync(jsFile)) {
  let content = readFileSync(jsFile, 'utf8');
  // Replace /src/icons/ with ./icons/ for proper distribution paths
  content = content.replace(/\/src\/icons\//g, './icons/');
  writeFileSync(jsFile, content);
  console.log('Fixed asset paths in media-library-full.iife.js');
}

console.log('Build complete!');
