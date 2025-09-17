# Workers

This directory contains Cloudflare Worker code for the Media Library Web Component.

## Available Workers

### CORS Proxy (`cors-proxy/`)

A CORS proxy worker that enables the Media Library to fetch content from external websites by bypassing CORS restrictions.

**Features:**
- Bypasses CORS restrictions
- Handles redirects properly
- Adds necessary CORS headers
- Simple URL parameter interface

**Usage:**
```bash
cd cors-proxy
npm install
wrangler login
npm run deploy
```

See `cors-proxy/README.md` for detailed setup instructions.
