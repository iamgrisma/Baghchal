interface Env {
  baghchal_kv?: KVNamespace;
  BAGHCHAL_KV?: KVNamespace;
  KV?: KVNamespace;
  [key: string]: any;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Global in-memory fallback for hot isolate
const memoryStore = new Map<string, any>();

function getKV(env: Env): KVNamespace | null {
  return env.baghchal_kv || env.BAGHCHAL_KV || env.KV || null;
}

async function readStore(key: string, env: Env): Promise<any> {
  // 1. Try KV if bound
  const kv = getKV(env);
  if (kv) {
    try {
      const raw = await kv.get(`room:${key}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }

  // 2. Try Edge Cache API (account-agnostic, built-in to all Cloudflare accounts)
  try {
    const cache = caches.default;
    const cacheUrl = new URL(`https://internal-cache.baghchal.local/room/${encodeURIComponent(key)}`);
    const match = await cache.match(cacheUrl);
    if (match) {
      return await match.json();
    }
  } catch (e) {}

  // 3. Fallback to isolate memory
  return memoryStore.get(key) || null;
}

async function writeStore(key: string, data: any, env: Env, ttlSeconds = 7200): Promise<void> {
  memoryStore.set(key, data);

  // 1. Write to KV if bound
  const kv = getKV(env);
  if (kv) {
    try {
      await kv.put(`room:${key}`, JSON.stringify(data), { expirationTtl: ttlSeconds });
    } catch (e) {}
  }

  // 2. Write to Edge Cache API
  try {
    const cache = caches.default;
    const cacheUrl = new URL(`https://internal-cache.baghchal.local/room/${encodeURIComponent(key)}`);
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttlSeconds}`,
      },
    });
    await cache.put(cacheUrl, response);
  } catch (e) {}
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const roomId = context.params.roomId as string;
  if (!roomId) {
    return new Response(JSON.stringify({ notFound: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const data = await readStore(roomId, context.env);

  if (!data) {
    return new Response(JSON.stringify({ notFound: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const roomId = context.params.roomId as string;
  if (!roomId) {
    return new Response(JSON.stringify({ error: 'Room ID required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let payload: any = {};
  try {
    payload = await context.request.json();
  } catch (e) {
    payload = {};
  }

  let current = await readStore(roomId, context.env);

  if (!current) {
    current = {
      roomId,
      candidatesHost: [],
      candidatesGuest: [],
      lastActive: Date.now(),
    };
  }

  current.lastActive = Date.now();

  if (payload.offer) current.offer = payload.offer;
  if (payload.answer) current.answer = payload.answer;
  if (payload.candidate) {
    if (payload.sender === 'host') {
      current.candidatesHost = current.candidatesHost || [];
      current.candidatesHost.push(payload.candidate);
    } else {
      current.candidatesGuest = current.candidatesGuest || [];
      current.candidatesGuest.push(payload.candidate);
    }
  }
  if (payload.gameState) {
    current.gameState = payload.gameState;
  }
  if (payload.players) {
    current.players = { ...current.players, ...payload.players };
  }

  await writeStore(roomId, current, context.env, 7200);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
