// workers/ai-agent-worker/constants.js
// Shared constants for AI Worker

export const AI_MODELS = {
  LLM: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  EMBEDDING: '@cf/baai/bge-base-en-v1.5',
};

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  ...CORS_HEADERS,
};

export const CACHE_CONFIG = { DEFAULT_TTL_SECONDS: 604800 };

export const BATCH_CONFIG = { MAX_BATCH_SIZE: 500 };
