async function handleSave(request, env, corsHeaders) {
  const { key, data } = await request.json();

  await env.R2_BUCKET.put(key, JSON.stringify(data), { httpMetadata: { contentType: 'application/json' } });

  return new Response(JSON.stringify({ success: true, key }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleLoad(request, env, corsHeaders) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  const object = await env.R2_BUCKET.get(key);

  if (!object) {
    return new Response(JSON.stringify(null), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const data = await object.json();
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleList(request, env, corsHeaders) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';

  const list = await env.R2_BUCKET.list({ prefix });
  const objects = list.objects.map((obj) => obj.key);

  return new Response(JSON.stringify({ objects }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleDelete(request, env, corsHeaders) {
  const { key } = await request.json();

  await env.R2_BUCKET.delete(key);

  return new Response(JSON.stringify({ success: true, key }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleBatchSave(request, env, corsHeaders) {
  const { mediaUsages, mode } = await request.json();

  const operations = mediaUsages.map((usage) => {
    const key = `${mode}/${usage.hash}.json`;
    return env.R2_BUCKET.put(key, JSON.stringify(usage), { httpMetadata: { contentType: 'application/json' } });
  });

  await Promise.all(operations);

  return new Response(JSON.stringify({
    success: true,
    saved: mediaUsages.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleBatchLoad(request, env, corsHeaders) {
  const { keys } = await request.json();

  const operations = keys.map(async (key) => {
    const object = await env.R2_BUCKET.get(key);
    if (!object) {
      return null;
    }
    return object.json();
  });

  const results = await Promise.all(operations);

  return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleBatchDelete(request, env, corsHeaders) {
  const { keys } = await request.json();

  const operations = keys.map((key) => env.R2_BUCKET.delete(key));

  await Promise.all(operations);

  return new Response(JSON.stringify({
    success: true,
    deleted: keys.length,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { method } = request;
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/api/save':
          return await handleSave(request, env, corsHeaders);
        case '/api/load':
          return await handleLoad(request, env, corsHeaders);
        case '/api/list':
          return await handleList(request, env, corsHeaders);
        case '/api/delete':
          return await handleDelete(request, env, corsHeaders);
        case '/api/batch-save':
          return await handleBatchSave(request, env, corsHeaders);
        case '/api/batch-load':
          return await handleBatchLoad(request, env, corsHeaders);
        case '/api/batch-delete':
          return await handleBatchDelete(request, env, corsHeaders);
        default:
          return new Response('Not found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
