# CORS Proxy Setup Guide

## Why You Need a CORS Proxy

The Media Library Web Component needs to fetch content from external websites. Due to CORS (Cross-Origin Resource Sharing) restrictions, browsers block these requests. A CORS proxy solves this by:

1. **Bypassing CORS restrictions** - The proxy adds necessary headers
2. **Avoiding rate limiting** - Requests come from the proxy's IP, not yours
3. **Enabling fast scraping** - No artificial delays needed

## Setup Options

### Option 1: Use Provided Worker Code

1. Copy the worker code from `workers/cors-proxy/`
2. Deploy to your Cloudflare account
3. Update your Media Library configuration

### Option 2: Use Third-Party Proxy

Use a public CORS proxy service (not recommended for production).

### Option 3: Self-Hosted Proxy

Deploy the worker code to your own infrastructure.

## Security Considerations

- The proxy allows requests to any URL
- Consider adding URL allowlists for production use
- Monitor usage to prevent abuse
