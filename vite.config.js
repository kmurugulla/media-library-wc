// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';
// eslint-disable-next-line import/no-extraneous-dependencies
import litCss from 'vite-plugin-lit-css';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, join, extname } from 'path';

export default defineConfig(({ mode }) => {
  const isSelfContained = mode === 'self-contained';
  const isSelfContainedUnminified = mode === 'self-contained-unminified';
  const isCore = mode === 'core';
  // Disable Lit dev mode warnings
  process.env.LIT_DEV_MODE = 'false';

  return {
    plugins: [
      litCss({
        include: ['**/*.css'],
        exclude: ['**/node_modules/**'],
        hmr: true,
      }),
      {
        name: 'serve-dist-files',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // Serve dist files as-is without transformation
            if (req.url && req.url.startsWith('/dist/')) {
              const filePath = join(process.cwd(), req.url);
              
              if (existsSync(filePath)) {
                const content = readFileSync(filePath);
                const ext = extname(filePath);
                
                if (ext === '.js') {
                  res.setHeader('Content-Type', 'application/javascript');
                } else if (ext === '.json') {
                  res.setHeader('Content-Type', 'application/json');
                }
                
                res.end(content);
                return;
              }
            }
            
            // Auto-serve index.html for directory requests
            if (req.url && !extname(req.url)) {
              const indexPath = join(process.cwd(), req.url, 'index.html');
              if (existsSync(indexPath)) {
                const content = readFileSync(indexPath, 'utf8');
                res.setHeader('Content-Type', 'text/html');
                res.end(content);
                return;
              }
            }
            
            next();
          });
        },
      },
      // Empty plugin - directories created as needed by build-dist.js
      {
        name: 'placeholder',
        writeBundle() {
          // No-op - build-dist.js handles all file copying
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
      fs: {
        strict: false,
      },
    },
    publicDir: false,
  };
});
