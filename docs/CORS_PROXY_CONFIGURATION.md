# CORS Proxy Configuration

The Media Library component supports configurable CORS proxy URLs, allowing host systems to use their own proxy servers for cross-origin requests.

## Overview

By default, the Media Library uses a public CORS proxy at `https://media-library-cors-proxy.aem-poc-lab.workers.dev/`. However, you can configure your own CORS proxy for better control, security, and reliability.

## Configuration Methods

### 1. HTML Attribute Configuration

Set the `cors-proxy` attribute on the media library element:

```html
<media-library 
  cors-proxy="https://your-cors-proxy.com/"
  storage="indexeddb"
  locale="en">
</media-library>
```

### 2. JavaScript Property Configuration

Set the `corsProxy` property after the component is ready:

```javascript
const mediaLibrary = document.querySelector('media-library');

// Wait for the component to be ready
await mediaLibrary.ready;

// Set your custom CORS proxy
mediaLibrary.corsProxy = 'https://your-cors-proxy.com/';

// The change will be applied to the content parser automatically
```

### 3. Constructor Configuration

When creating the component programmatically:

```javascript
import { MediaLibrary } from './dist/media-library.es.js';

const mediaLibrary = await MediaLibrary.create({
  corsProxy: 'https://your-cors-proxy.com/',
  storage: 'indexeddb',
  locale: 'en'
});
```

## CORS Proxy Requirements

Your CORS proxy must meet these requirements:

### 1. URL Format
The proxy should accept requests with a `url` query parameter:

```
https://your-cors-proxy.com/?url=https://target-site.com/sitemap.xml
```

### 2. Response Headers
The proxy must include these CORS headers in responses:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
```

### 3. Request Forwarding
The proxy should:
- Forward the original request method (GET, POST, etc.)
- Forward request headers
- Handle redirects appropriately
- Return the target server's response with CORS headers added

## Example CORS Proxy Implementation

Here's a simple CORS proxy implementation using Cloudflare Workers:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      redirect: 'manual'
    })

    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', '*')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    })
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 500 })
  }
}
```

## Security Considerations

### 1. Access Control
- Implement authentication/authorization if needed
- Consider rate limiting to prevent abuse
- Log requests for monitoring

### 2. URL Validation
- Validate target URLs to prevent SSRF attacks
- Block access to internal/private networks
- Implement allowlists for trusted domains

### 3. Content Filtering
- Consider filtering malicious content
- Implement size limits for responses
- Block certain file types if needed

## Testing Your CORS Proxy

Use this test to verify your CORS proxy works correctly:

```javascript
async function testCorsProxy(proxyUrl) {
  try {
    const testUrl = `${proxyUrl}?url=${encodeURIComponent('https://httpbin.org/json')}`;
    const response = await fetch(testUrl);
    
    if (response.ok) {
      console.log('CORS proxy test successful!');
      return true;
    } else {
      console.error(`CORS proxy test failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`CORS proxy test failed: ${error.message}`);
    return false;
  }
}

// Test your proxy
testCorsProxy('https://your-cors-proxy.com/');
```

## Dynamic Configuration

You can change the CORS proxy at runtime:

```javascript
// Change the CORS proxy
mediaLibrary.corsProxy = 'https://new-proxy.com/';

// The content parser will use the new proxy for subsequent requests
// No need to reinitialize the component
```

## Fallback Behavior

If no CORS proxy is configured, the component will:
1. Use the default proxy: `https://media-library-cors-proxy.aem-poc-lab.workers.dev/`
2. Log a warning to the console
3. Continue operation with the default proxy

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure your proxy includes the required CORS headers
2. **404 errors**: Verify the proxy URL is correct and accessible
3. **Timeout errors**: Check if your proxy has appropriate timeout settings
4. **Authentication errors**: Ensure your proxy doesn't require authentication

### Debug Mode

Enable debug logging to troubleshoot CORS proxy issues:

```javascript
// Enable debug mode
localStorage.setItem('media-library-debug', 'true');

// Check the console for CORS proxy requests
```

## Examples

See the `examples/custom-cors-proxy/` directory for a complete working example of CORS proxy configuration.
