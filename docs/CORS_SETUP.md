# CORS Setup Guide

## Overview

This guide explains how to set up and use the enhanced CORS solution for the Media Library, eliminating the need for browser extensions.

## Quick Start

### Option 1: Use Built-in Proxy (Recommended)

The Media Library now includes a built-in CORS proxy server that runs alongside the development server.

```bash
# Install dependencies (if not already done)
npm install

# Start development server with CORS proxy
npm run dev:with-proxy

# Or for testing
npm run test:with-proxy
```

This will start:
- Main development server on `http://localhost:3000`
- CORS proxy server on `http://localhost:3001`

### Option 2: Manual Setup

If you prefer to run servers separately:

```bash
# Terminal 1: Start CORS proxy server
npm run cors-proxy

# Terminal 2: Start development server
npm run dev
```

## How It Works

### Automatic Fallback Chain

The CORS solution uses a multi-tier fallback approach:

1. **Direct Request**: First attempts a direct fetch
2. **Local Proxy**: Uses the built-in CORS proxy server
3. **Vite Proxy**: Uses Vite's proxy configuration
4. **External Proxies**: Falls back to external CORS proxy services
5. **Alternative Methods**: Tries different fetch modes and headers

### Proxy Services Used

#### Local Proxy Server
- **URL**: `http://localhost:3001`
- **Usage**: `http://localhost:3001/https://example.com`
- **Benefits**: Fast, reliable, no external dependencies

#### External Proxy Services
- `https://api.allorigins.win/raw?url=`
- `https://cors-anywhere.herokuapp.com/`
- `https://corsproxy.io/?`
- `https://thingproxy.freeboard.io/fetch/`
- `https://api.codetabs.com/v1/proxy?quest=`

## Configuration

### Vite Configuration

The Vite configuration includes proxy endpoints:

```javascript
proxy: {
  '/api/direct': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  '/api/cors': {
    target: 'https://api.allorigins.win/raw?url=',
    changeOrigin: true,
  },
  '/api/proxy': {
    target: 'https://cors-anywhere.herokuapp.com/',
    changeOrigin: true,
  },
}
```

### CORS Fetch Utility

The `CorsFetch` class automatically handles:

- Development mode detection
- Error type identification
- Proxy fallback selection
- URL encoding/decoding
- Header management

## Usage Examples

### Basic Usage

```javascript
import CorsFetch from './utils/cors-fetch.js';

const corsFetch = new CorsFetch();

// This will automatically try all fallback methods
const response = await corsFetch.fetch('https://example.com');
const data = await response.text();
```

### With Options

```javascript
const response = await corsFetch.fetch('https://example.com', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ data: 'example' }),
});
```

### Check URL Accessibility

```javascript
const isAccessible = await corsFetch.isAccessible('https://example.com');
if (isAccessible) {
  console.log('URL is accessible');
}
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: If port 3001 is in use, the CORS proxy server will fail to start
   - **Solution**: Kill the process using port 3001 or modify the port in `scripts/cors-proxy-server.js`

2. **External Proxy Failures**: External proxy services may be down or rate-limited
   - **Solution**: The system automatically tries multiple proxies, so this should resolve itself

3. **Network Issues**: Some networks block external proxy services
   - **Solution**: Use the local proxy server (Option 1 above)

### Debug Information

Enable console logging to see which proxy services are being used:

```javascript
// The CORS fetch utility logs detailed information about:
// - Which proxy is being tried
// - Success/failure of each attempt
// - Final result
```

### Manual Testing

Test the CORS proxy server directly:

```bash
# Test local proxy
curl "http://localhost:3001/https://httpbin.org/get"

# Test external proxy
curl "https://api.allorigins.win/raw?url=https://httpbin.org/get"
```

## Production Considerations

### For Production Deployment

1. **Server-Side Proxy**: Implement a server-side proxy for production
2. **CORS Headers**: Ensure your production server sends proper CORS headers
3. **Rate Limiting**: Implement rate limiting for proxy requests
4. **Security**: Validate and sanitize URLs before proxying

### Security Notes

- The local proxy server is designed for development only
- External proxy services may log your requests
- Always validate URLs before making proxy requests
- Consider implementing authentication for production proxies

## Advanced Configuration

### Custom Proxy Server

You can modify `scripts/cors-proxy-server.js` to:

- Add authentication
- Implement caching
- Add rate limiting
- Customize headers
- Add logging

### Custom External Proxies

Add your own proxy services to the `externalProxies` array in `src/utils/cors-fetch.js`:

```javascript
this.externalProxies = [
  'https://your-custom-proxy.com/',
  // ... existing proxies
];
```

## Benefits

✅ **No Browser Extensions Required**: Works out of the box
✅ **Automatic Fallbacks**: Multiple proxy services ensure reliability
✅ **Development Friendly**: Easy setup with npm scripts
✅ **Production Ready**: Can be adapted for production use
✅ **Transparent**: Works with existing code without changes
✅ **Debuggable**: Detailed logging for troubleshooting

## Support

If you encounter issues:

1. Check the console for detailed error messages
2. Verify the CORS proxy server is running
3. Test external proxy services manually
4. Check network connectivity
5. Review the troubleshooting section above
