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
  'refresh.svg', 'eye.svg', 'link.svg',
  'share.svg', 'accessibility.svg', 'reference.svg', 'info.svg', 'open-in.svg', 'play.svg',
  'filter.svg', 'document.svg', 'all.svg', 'chevron-right.svg',
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

// No locales to copy - i18n removed

const jsFiles = [
  'media-library.iife.js',
];

jsFiles.forEach((jsFile) => {
  const filePath = join(distDir, jsFile);
  if (existsSync(filePath)) {
    let content = readFileSync(filePath, 'utf8');
    content = content.replace(/\/src\/icons\//g, './icons/');
    
    // Ensure IIFE exposes to window.MediaLibrary
    if (!content.includes('window.MediaLibrary')) {
      content += '\nwindow.MediaLibrary = MediaLibrary;\n';
    }
    
    writeFileSync(filePath, content);
    // eslint-disable-next-line no-console
    console.log(`Fixed asset paths in ${jsFile}`);
  }
});

// eslint-disable-next-line no-console
console.log('Build complete!');
