// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';
// eslint-disable-next-line import/no-extraneous-dependencies
import litCss from 'vite-plugin-lit-css';

export default defineConfig(({ mode }) => {
  const isSelfContained = mode === 'self-contained';

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
        entry: 'src/index.js',
        name: 'MediaLibrary',
        fileName: (format) => (isSelfContained ? `media-library-full.${format}.js` : `media-library.${format}.js`),
        formats: isSelfContained ? ['iife'] : ['es', 'umd'],
      },
      rollupOptions: {
        external: isSelfContained ? [] : ['lit'],
        output: {
          globals: isSelfContained ? {} : { lit: 'lit' },
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
      open: '/test/index.html',
      // Enable HMR for CSS files
      hmr: { overlay: true },
    },
  };
});
