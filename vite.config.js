// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';
// eslint-disable-next-line import/no-extraneous-dependencies
import litCss from 'vite-plugin-lit-css';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isSelfContained = mode === 'self-contained';
  const isSelfContainedUnminified = mode === 'self-contained-unminified';
  const isCore = mode === 'core';
  // Disable Lit dev mode warnings
  process.env.LIT_DEV_MODE = 'false';

  return {
    define: {
      // AI Agent feature flags
      __AI_ENABLED__: JSON.stringify(process.env.VITE_AI_ENABLED === 'true'),
      __AI_WORKER_URL__: JSON.stringify(process.env.VITE_AI_WORKER_URL || ''),
      __AI_API_KEY__: JSON.stringify(process.env.VITE_AI_API_KEY || ''),
    },
    plugins: [
      litCss({
        include: ['**/*.css'],
        exclude: ['**/node_modules/**'],
        hmr: true,
      }),
      {
        name: 'copy-data-sources',
        writeBundle() {
          const distDir = resolve(__dirname, 'dist');

          const sourcesDir = resolve(distDir, 'sources');
          if (!existsSync(sourcesDir)) {
            mkdirSync(sourcesDir, { recursive: true });
          }

          const examplesDir = resolve(distDir, 'examples');
          if (!existsSync(examplesDir)) {
            mkdirSync(examplesDir, { recursive: true });
          }

          const docsDir = resolve(distDir, 'docs');
          if (!existsSync(docsDir)) {
            mkdirSync(docsDir, { recursive: true });
          }

          const assetsDir = resolve(distDir, 'assets');
          if (!existsSync(assetsDir)) {
            mkdirSync(assetsDir, { recursive: true });
          }

          const localesDir = resolve(distDir, 'locales');
          if (!existsSync(localesDir)) {
            mkdirSync(localesDir, { recursive: true });
          }

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
        '@lit-labs/virtualizer',
        '@lit-labs/virtualizer/virtualize.js',
        '@lit-labs/virtualizer/layouts/grid.js',
      ],
      exclude: isSelfContained ? [] : ['lit'],
    },
    json: {
      namedExports: false,
      stringify: false,
    },
    css: {
      modules: {
        generateScopedName: '[name]__[local]___[hash:base64:5]',
        localsConvention: 'camelCase',
      },
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
            return `media-library-min.${format}.js`;
          } if (isSelfContainedUnminified) {
            return `media-library.${format}.js`;
          }
          return `media-library.${format}.js`;
        },
        formats: (isSelfContained || isSelfContainedUnminified) ? ['iife'] : ['es', 'umd'],
      },
      rollupOptions: {
        external: (isSelfContained || isSelfContainedUnminified) ? [] : ['lit'],
        output: {
          globals: (isSelfContained || isSelfContainedUnminified) ? {} : { lit: 'lit' },
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'style.css';
            }
            return '[name].[ext]';
          },
        },
      },
      assetsInlineLimit: 0,
      cssCodeSplit: false,
      sourcemap: false,
      minify: isSelfContainedUnminified ? false : 'terser',
      ...(isSelfContainedUnminified ? {} : {
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
      }),
      copyPublicDir: false,
      emptyOutDir: false,
    },
    server: {
      port: 3000,
      strictPort: false,
      open: '/examples/sitemap/index.html',
      hmr: { overlay: true },
    },
  };
});
