import { css } from 'lit';

export function getStyles(cssContent) {
  return css([cssContent]);
}

export function getCssPath(currentFile) {
  const jsUrl = new URL(currentFile);
  const jsPath = jsUrl.pathname;
  const cssPath = jsPath.replace(/\.js$/, '.css');
  return `${cssPath}?inline`;
}
