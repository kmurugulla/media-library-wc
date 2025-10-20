import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
const iconsDir = join(distDir, 'icons');

if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir);
}

const icons = [
  'close.svg', 'photo.svg', 'video.svg', 'pdf.svg',
  'external-link.svg', 'copy.svg', 'search.svg',
  'list.svg', 'grid.svg', 'refresh.svg', 'eye.svg', 'link.svg',
  'share.svg', 'accessibility.svg', 'reference.svg', 'info.svg', 'open-in.svg', 'play.svg',
];

icons.forEach((icon) => {
  const srcPath = join('src', 'icons', icon);
  const destPath = join(iconsDir, icon);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    // eslint-disable-next-line no-console
    console.log(`Copied ${icon}`);
  }
});

const localesDir = join(distDir, 'locales');
if (!existsSync(localesDir)) {
  mkdirSync(localesDir);
}

const locales = ['en.json', 'es.json', 'de.json', 'fr.json'];
locales.forEach((locale) => {
  const srcPath = join('src', 'locales', locale);
  const destPath = join(localesDir, locale);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    // eslint-disable-next-line no-console
    console.log(`Copied ${locale}`);
  }
});

const dataDir = join(distDir, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir);
}

const dataFiles = ['category-patterns.json'];
dataFiles.forEach((dataFile) => {
  const srcPath = join('src', 'data', dataFile);
  const destPath = join(dataDir, dataFile);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    // eslint-disable-next-line no-console
    console.log(`Copied ${dataFile}`);
  }
});

const jsFiles = [
  'media-library.iife.js',
  'media-library-min.iife.js',
];

jsFiles.forEach((jsFile) => {
  const filePath = join(distDir, jsFile);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, 'utf8');
    content = content.replace(/\/src\/icons\//g, './icons/');
    writeFileSync(filePath, content);
    // eslint-disable-next-line no-console
    console.log(`Fixed asset paths in ${jsFile}`);
  }
});

// eslint-disable-next-line no-console
console.log('Build complete!');
