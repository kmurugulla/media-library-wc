# Self-Hosting Media Library

## CORS Proxy Setup

The Media Library requires a CORS proxy for external website scraping. Follow these steps:

1. **Deploy CORS Proxy:**
   ```bash
   cd workers/cors-proxy
   npm install
   wrangler login
   npm run deploy
   ```

2. **Configure Media Library:**
   ```javascript
   const mediaLibrary = new MediaLibrary({
     corsProxy: 'https://your-worker.your-account.workers.dev/'
   });
   ```

3. **Test the Setup:**
   ```bash
   curl "https://your-worker.your-account.workers.dev/?url=https://example.com"
   ```
