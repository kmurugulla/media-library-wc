# Media Library CORS Proxy

This Cloudflare Worker provides CORS proxy functionality for the Media Library Web Component.

## Setup

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy the worker:
   ```bash
   npm run deploy
   ```

## Configuration

Update the worker name in `wrangler.toml` to match your Cloudflare account.

## Usage

The worker will be available at: `https://your-worker-name.your-account.workers.dev`

Use it in your Media Library by setting the `corsProxy` option:

```javascript
const mediaLibrary = new MediaLibrary({
  corsProxy: 'https://your-worker-name.your-account.workers.dev/'
});
```

## Testing

Test your deployed worker:
```bash
curl "https://your-worker-name.your-account.workers.dev/?url=https://example.com"
```
