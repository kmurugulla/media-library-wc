#!/usr/bin/env node
// workers/ai-agent-worker/generate-api-key.js
// Generate a secure API key for the AI Agent Worker

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateApiKey() {
  // Generate 4 segments of 8 characters each (32 chars total)
  const segment1 = crypto.randomBytes(4).toString('hex');
  const segment2 = crypto.randomBytes(4).toString('hex');
  const segment3 = crypto.randomBytes(4).toString('hex');
  const segment4 = crypto.randomBytes(4).toString('hex');

  return `sk-${segment1}-${segment2}-${segment3}-${segment4}`;
}

function updateWranglerToml(apiKey) {
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  let content = fs.readFileSync(wranglerPath, 'utf8');

  // Replace any existing API key (placeholder or old key) - must be at start of line
  content = content.replace(
    /^API_KEY = ".*"/m,
    `API_KEY = "${apiKey}"`,
  );

  fs.writeFileSync(wranglerPath, content, 'utf8');
  return true;
}

function updateEnvFile(apiKey) {
  const rootEnvPath = path.join(__dirname, '../../../.env.production');

  if (fs.existsSync(rootEnvPath)) {
    let content = fs.readFileSync(rootEnvPath, 'utf8');

    // Update or add the API key
    if (content.includes('VITE_AI_API_KEY=')) {
      content = content.replace(
        /VITE_AI_API_KEY=.*/,
        `VITE_AI_API_KEY=${apiKey}`,
      );
    } else {
      content += `\nVITE_AI_API_KEY=${apiKey}\n`;
    }

    fs.writeFileSync(rootEnvPath, content, 'utf8');
    return true;
  }

  return false;
}

// Main execution
console.log('🔐 Generating API Key...\n');

const apiKey = generateApiKey();

console.log('✅ Generated API Key:');
console.log(`   ${apiKey}\n`);

console.log('📝 Updating configuration files...\n');

// Update wrangler.toml
const wranglerUpdated = updateWranglerToml(apiKey);
if (wranglerUpdated) {
  console.log('✅ Updated: workers/ai-agent-worker/wrangler.toml');
} else {
  console.log('⚠️  Failed to update wrangler.toml');
}

// Update .env.production
const envUpdated = updateEnvFile(apiKey);
if (envUpdated) {
  console.log('✅ Updated: .env.production');
} else {
  console.log('⚠️  .env.production not found (optional)');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 API Key Setup Complete!\n');
console.log('Next steps:');
console.log('  1. Deploy worker: cd workers/ai-agent-worker && wrangler deploy');
console.log('  2. Build frontend: cd ../.. && npm run build:ai');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('⚠️  IMPORTANT: Keep this key secure!');
console.log('   Do NOT commit wrangler.toml or .env.production to Git\n');
