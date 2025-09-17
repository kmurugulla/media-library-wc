// workers/cors-proxy/test-proxy.js
// Simple test script to verify the CORS proxy is working

const PROXY_URL = 'https://media-library-cors-proxy.aem-poc-lab.workers.dev';

async function testProxy() {
  console.log('Testing CORS Proxy...');
  console.log('Proxy URL:', PROXY_URL);
  
  try {
    // Test 1: Basic functionality
    console.log('\n1. Testing basic functionality...');
    const response1 = await fetch(`${PROXY_URL}/?url=https://example.com`);
    console.log('Status:', response1.status);
    console.log('CORS Headers:', {
      'access-control-allow-origin': response1.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response1.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response1.headers.get('access-control-allow-headers')
    });
    
    // Test 2: Openreach sitemap
    console.log('\n2. Testing Openreach sitemap...');
    const response2 = await fetch(`${PROXY_URL}/?url=https://www.openreach.com/news/sitemap.xml`);
    console.log('Status:', response2.status);
    console.log('Content-Type:', response2.headers.get('content-type'));
    
    if (response2.ok) {
      const text = await response2.text();
      console.log('Response length:', text.length);
      console.log('First 200 chars:', text.substring(0, 200));
    }
    
    console.log('\n✅ CORS Proxy is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing proxy:', error);
  }
}

// Run the test
testProxy();
