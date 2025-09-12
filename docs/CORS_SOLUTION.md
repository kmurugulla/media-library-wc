# CORS Solution for Media Library

## Overview

This document explains the CORS (Cross-Origin Resource Sharing) solution implemented in the Media Library to handle cross-origin requests during development and testing.

## Problem

When developing web applications that need to fetch data from external domains, browsers enforce CORS policies that can block requests from localhost to external sites. This is a common issue when testing against external websites like `aem.live`.

## Solution

The Media Library implements a comprehensive CORS solution with multiple fallback mechanisms:

### 1. CORS-Aware Fetch Utility (`src/utils/cors-fetch.js`)

A custom fetch utility that automatically handles CORS issues:

- **Direct Fetch**: First attempts a direct fetch request
- **CORS Detection**: Detects CORS-related errors
- **Proxy Fallbacks**: Automatically tries multiple proxy services
- **Development Mode**: Uses Vite proxy endpoints in development
- **External Proxies**: Falls back to external CORS proxy services

### 2. Vite Development Server Proxy

The Vite configuration includes proxy endpoints for development:

```javascript
proxy: {
  '/api/proxy': {
    target: 'https://cors-anywhere.herokuapp.com/',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
  },
  '/api/cors': {
    target: 'https://api.allorigins.win/raw?url=',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/cors/, ''),
  },
}
```

### 3. Updated Utilities

All fetch operations in the following utilities now use the CORS-aware fetch:

- `src/utils/sitemap.js` - Sitemap discovery and parsing
- `src/utils/parser.js` - Page content parsing
- Any other utilities that make external requests

### 4. User-Friendly Error Messages

The test interface provides clear feedback about CORS issues and explains the fallback mechanisms to users.

## Usage

### For Developers

The CORS solution is automatic and requires no additional configuration. Simply use the existing fetch operations in your code.

### For Testing

1. **Local Development**: The Vite proxy automatically handles CORS issues
2. **External Sites**: The application will automatically try proxy services
3. **Error Handling**: Clear error messages explain what's happening

### Proxy Services Used

1. **Vite Proxy** (Development only):
   - `/api/proxy` → `cors-anywhere.herokuapp.com`
   - `/api/cors` → `api.allorigins.win`

2. **External Proxies** (Fallback):
   - `https://api.allorigins.win/raw?url=`
   - `https://cors-anywhere.herokuapp.com/`

## Error Handling

The solution provides comprehensive error handling:

- **CORS Detection**: Automatically identifies CORS-related errors
- **Fallback Chain**: Tries multiple proxy services in sequence
- **User Feedback**: Clear error messages explaining the issue
- **Console Logging**: Detailed logging for debugging

## Best Practices

1. **Development**: Use the Vite development server for local testing
2. **Production**: Ensure your production environment has proper CORS headers
3. **Testing**: Use local test servers when possible to avoid CORS issues
4. **Error Handling**: Always provide fallback mechanisms for external requests

## Limitations

1. **External Proxy Dependencies**: Relies on third-party proxy services
2. **Rate Limiting**: External proxies may have rate limits
3. **Reliability**: External proxies may not always be available
4. **Security**: Be cautious when using external proxy services

## Troubleshooting

### Common Issues

1. **All Proxies Fail**: Try using a different website or local test server
2. **Rate Limiting**: Wait and retry, or use a different proxy service
3. **Network Issues**: Check your internet connection and firewall settings

### Debug Information

Enable console logging to see which proxy services are being used and any errors that occur during the fallback process.

## Future Improvements

1. **Custom Proxy Server**: Implement a dedicated proxy server for the application
2. **Caching**: Add caching for proxy responses to improve performance
3. **Health Checks**: Monitor proxy service availability
4. **Configuration**: Allow users to configure proxy services
