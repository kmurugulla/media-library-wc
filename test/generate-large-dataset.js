"use strict";

function generateLargeDataset(count = 1000) {
  const mediaTypes = ['img > jpg', 'img > png', 'img > webp', 'video > mp4', 'video > webm', 'link > pdf', 'link > doc'];
  const documents = ['/index.html', '/about.html', '/contact.html', '/products.html', '/services.html', '/blog.html'];
  const contexts = [
    'img > In div: hero-section > text: Welcome to our site',
    'img > In div: header > text: Navigation',
    'video > In div: video-section > text: About us',
    'link > In div: resources > text: Download our brochure',
    'img > In div: gallery > text: Image gallery',
    'video > In div: testimonials > text: Customer testimonials'
  ];

  const dataset = [];
  
  for (let i = 0; i < count; i++) {
    const mediaType = mediaTypes[Math.floor(Math.random() * mediaTypes.length)];
    const doc = documents[Math.floor(Math.random() * documents.length)];
    const context = contexts[Math.floor(Math.random() * contexts.length)];
    
    const media = {
      url: `https://example.com/media/item-${i}.${getFileExtension(mediaType)}`,
      name: `item-${i}.${getFileExtension(mediaType)}`,
      alt: i % 3 === 0 ? `Alt text for item ${i}` : (i % 3 === 1 ? '' : null),
      type: mediaType,
      doc: doc,
      ctx: context,
      hash: generateHash(),
      firstUsedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random date within last 30 days
      lastUsedAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000, // Random date within last 7 days
      usageCount: Math.floor(Math.random() * 10) + 1
    };
    
    dataset.push(media);
  }
  
  return dataset;
}

function getFileExtension(mediaType) {
  const extensions = {
    'img > jpg': 'jpg',
    'img > png': 'png', 
    'img > webp': 'webp',
    'video > mp4': 'mp4',
    'video > webm': 'webm',
    'link > pdf': 'pdf',
    'link > doc': 'doc'
  };
  return extensions[mediaType] || 'jpg';
}

function generateHash() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

if (typeof window !== 'undefined') {
  window.generateLargeDataset = generateLargeDataset;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateLargeDataset };
}
