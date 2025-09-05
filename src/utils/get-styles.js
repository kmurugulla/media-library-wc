// src/utils/get-styles.js
import { css } from 'lit';

/**
 * Utility function to create Lit CSS styles from a CSS string.
 * This is a simple wrapper around Lit's css template literal function.
 * 
 * @param {string} cssContent - The CSS content as a string (from ?inline import)
 * @returns {CSSResult} - Lit CSS template literal result
 * 
 * @example
 * // In component.js
 * import { getStyles } from '../utils/get-styles.js';
 * import componentStyles from './component.css?inline';
 * 
 * class MyComponent extends LitElement {
 *   static styles = getStyles(componentStyles);
 * }
 */
export function getStyles(cssContent) {
  return css([cssContent]);
}

/**
 * Helper function to create a CSS import path based on the current file.
 * This is mainly for documentation and consistency.
 * 
 * @param {string} currentFile - The current file path (usually import.meta.url)
 * @returns {string} - The expected CSS file path
 * 
 * @example
 * // In src/components/my-component/my-component.js
 * const cssPath = getCssPath(import.meta.url);
 * // Returns: './my-component.css?inline'
 */
export function getCssPath(currentFile) {
  const jsUrl = new URL(currentFile);
  const jsPath = jsUrl.pathname;
  const cssPath = jsPath.replace(/\.js$/, '.css');
  return cssPath + '?inline';
}
