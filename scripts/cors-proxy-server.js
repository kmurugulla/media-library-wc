#!/usr/bin/env node

import http from 'http';
import https from 'https';
import url from 'url';

const PORT = 3001;

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const targetUrl = req.url.substring(1);
  
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: No URL provided');
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Invalid URL');
    return;
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  };

  const relevantHeaders = ['content-type', 'authorization', 'x-requested-with'];
  relevantHeaders.forEach(header => {
    if (req.headers[header]) {
      options.headers[header] = req.headers[header];
    }
  });

  const proxyReq = client.request(options, (proxyRes) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    Object.keys(proxyRes.headers).forEach(key => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, proxyRes.headers[key]);
      }
    });

    res.writeHead(proxyRes.statusCode);

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy request error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error: ' + error.message);
  });

  req.on('close', () => {
    proxyReq.destroy();
  });

  req.pipe(proxyReq);
});

findAvailablePort(PORT).then((availablePort) => {
  server.listen(availablePort, () => {
    console.log(`CORS Proxy Server running on http://localhost:${availablePort}`);
    console.log(`Usage: http://localhost:${availablePort}/https://example.com`);
    
    if (availablePort !== PORT) {
      console.log(`\n⚠️  Note: CORS proxy is running on port ${availablePort} instead of ${PORT}`);
      console.log('You may need to update the Vite proxy configuration if using custom setup.');
    }
  });
}).catch((error) => {
  console.error('Failed to start CORS proxy server:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down CORS proxy server...');
  server.close(() => {
    console.log('CORS proxy server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down CORS proxy server...');
  server.close(() => {
    console.log('CORS proxy server closed.');
    process.exit(0);
  });
});
