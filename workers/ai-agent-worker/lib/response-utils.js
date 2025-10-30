// workers/ai-agent-worker/response-utils.js
// HTTP response utilities

import { JSON_HEADERS } from './constants.js';

export function createJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export function createErrorResponse(error, status = 500) {
  return new Response(JSON.stringify({
    error: error.message || error,
    stack: error.stack,
  }), {
    status,
    headers: JSON_HEADERS,
  });
}

export function withErrorHandling(handler) {
  return async (request, env) => {
    try {
      return await handler(request, env);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}
