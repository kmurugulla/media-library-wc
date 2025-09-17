// workers/cors-proxy/worker.js
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
    // Fetch the target URL
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      redirect: 'manual' // Handle redirects manually
    })

    // Create new headers with CORS support
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', '*')

    // Return the response with CORS headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    })
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 500 })
  }
}
