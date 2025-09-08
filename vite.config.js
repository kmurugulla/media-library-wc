import { defineConfig } from 'vite';
import litCss from 'vite-plugin-lit-css';

export default defineConfig({
  plugins: [
    litCss({
      // Enable CSS imports in Lit components
      include: ['**/*.css'],
      // Ensure proper scoping for Lit components
      exclude: ['**/node_modules/**'],
      // Enable HMR for CSS files
      hmr: true
    })
  ],
  optimizeDeps: {
    include: [
      'exifr'
    ],
    exclude: ['lit']
  },
  json: {
    namedExports: false,
    stringify: false
  },
  css: {
    // Enable CSS modules-like behavior for Lit components
    modules: {
      // Generate scoped class names for Lit components
      generateScopedName: '[name]__[local]___[hash:base64:5]',
      // Handle CSS imports properly
      localsConvention: 'camelCase'
    },
    // Ensure CSS is processed correctly
    postcss: {
      plugins: []
    }
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'MediaLibrary',
      fileName: 'media-library',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: ['lit'],
      output: {
        globals: {
          lit: 'lit'
        }
      }
    },
    cssCodeSplit: true,
    sourcemap: true
  },
  server: {
    port: 3000,
    open: '/test/index.html',
    // Enable HMR for CSS files
    hmr: {
      overlay: true
    }
  }
});
