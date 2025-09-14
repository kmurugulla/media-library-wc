// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';
// eslint-disable-next-line import/no-extraneous-dependencies
import litCss from 'vite-plugin-lit-css';
// eslint-disable-next-line import/no-extraneous-dependencies
import { mkdirSync, existsSync } from 'fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isSelfContained = mode === 'self-contained';
  const isCore = mode === 'core';

  return {
    plugins: [
      litCss({
        // Enable CSS imports in Lit components
        include: ['**/*.css'],
        // Ensure proper scoping for Lit components
        exclude: ['**/node_modules/**'],
        // Enable HMR for CSS files
        hmr: true,
      }),
      // Custom plugin to copy data sources and examples
      {
        name: 'copy-data-sources',
        writeBundle() {
          const distDir = resolve(__dirname, 'dist');

          // Copy data sources
          const sourcesDir = resolve(distDir, 'sources');
          if (!existsSync(sourcesDir)) {
            mkdirSync(sourcesDir, { recursive: true });
          }

          // Copy examples
          const examplesDir = resolve(distDir, 'examples');
          if (!existsSync(examplesDir)) {
            mkdirSync(examplesDir, { recursive: true });
          }

          // Copy docs
          const docsDir = resolve(distDir, 'docs');
          if (!existsSync(docsDir)) {
            mkdirSync(docsDir, { recursive: true });
          }

          // Copy assets
          const assetsDir = resolve(distDir, 'assets');
          if (!existsSync(assetsDir)) {
            mkdirSync(assetsDir, { recursive: true });
          }

          // Copy locales
          const localesDir = resolve(distDir, 'locales');
          if (!existsSync(localesDir)) {
            mkdirSync(localesDir, { recursive: true });
          }

          // Copy data
          const dataDir = resolve(distDir, 'data');
          if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
          }
        },
      },
    ],
    optimizeDeps: {
      include: [
        'exifr',
      ],
      exclude: isSelfContained ? [] : ['lit'],
    },
    json: {
      namedExports: false,
      stringify: false,
    },
    css: {
      // Enable CSS modules-like behavior for Lit components
      modules: {
        // Generate scoped class names for Lit components
        generateScopedName: '[name]__[local]___[hash:base64:5]',
        // Handle CSS imports properly
        localsConvention: 'camelCase',
      },
      // Ensure CSS is processed correctly
      postcss: { plugins: [] },
    },
    build: {
      lib: {
        entry: isCore ? 'src/components/media-library.js' : 'src/index.js',
        name: 'MediaLibrary',
        fileName: (format) => {
          if (isCore) {
            return `media-library-core.${format}.js`;
          } if (isSelfContained) {
            return `media-library-full.${format}.js`;
          }
          return `media-library.${format}.js`;
        },
        formats: isSelfContained ? ['iife'] : ['es', 'umd'],
      },
      rollupOptions: {
        external: isSelfContained ? [] : ['lit', 'lit/directives/repeat.js', 'lit/directives/ref.js'],
        output: {
          globals: isSelfContained ? {} : { lit: 'lit', 'lit/directives/repeat.js': 'lit', 'lit/directives/ref.js': 'lit' },
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'style.css';
            }
            return '[name].[ext]';
          },
        },
      },
      // Ensure assets are copied and accessible
      assetsInlineLimit: 0, // Don't inline assets, keep them as separate files
      cssCodeSplit: false,
      sourcemap: false, // Disable source maps for production
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2,
        },
        mangle: { safari10: true },
        format: { comments: false },
      },
      copyPublicDir: false,
      emptyOutDir: false,
    },
    server: {
      port: 3000,
      strictPort: true, // Don't try other ports if 3000 is busy
      open: '/examples/sitemap/index.html',
      // Enable HMR for CSS files
      hmr: { overlay: true },
      // CORS proxy configuration for development
      proxy: {
        '/api/proxy': {
          target: 'https://cors-anywhere.herokuapp.com/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Add CORS headers
              proxyReq.setHeader('Origin', 'https://cors-anywhere.herokuapp.com');
            });
          },
        },
        // Alternative proxy using allorigins.win
        '/api/cors': {
          target: 'https://api.allorigins.win',
          changeOrigin: true,
          rewrite: (path) => {
            // Extract the encoded URL from the path and convert to query parameter
            const encodedUrl = path.replace(/^\/api\/cors\//, '');
            return `/raw?url=${encodedUrl}`;
          },
        },
      },
    },
  };
});
