import { defineConfig } from 'vite';
import litCss from 'vite-plugin-lit-css';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isSelfContained = mode === 'self-contained';
  const isCore = mode === 'core';

  return {
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
      assetsInlineLimit: 0,
      cssCodeSplit: false,
      sourcemap: false,
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
      strictPort: true,
      open: '/examples/sitemap/index.html',
      hmr: { overlay: true },
    },
  };
});
