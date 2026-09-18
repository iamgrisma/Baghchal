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

// Global in-memory fallback for local dev or if KV is temporarily unbound
const fallbackStore = new Map<string, any>();

function getKV(env: Env): KVNamespace | null {
  return env.baghchal_kv || env.BAGHCHAL_KV || env.KV || null;
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

  const kv = getKV(context.env);

  let data = null;
  if (kv) {
    try {
      const raw = await kv.get(`room:${roomId}`);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      console.error('KV read error:', e);
    }
  }

  if (!data) {
    data = fallbackStore.get(roomId) || null;
  }

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

  const kv = getKV(context.env);

  // Read existing room data
  let current: any = null;
  if (kv) {
    try {
      const raw = await kv.get(`room:${roomId}`);
      if (raw) current = JSON.parse(raw);
    } catch (e) {}
  }

  if (!current) {
    current = fallbackStore.get(roomId) || {
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

  // Save back to KV (expires in 2 hours)
  if (kv) {
    try {
      await kv.put(`room:${roomId}`, JSON.stringify(current), {
        expirationTtl: 7200, // 2 hours
      });
    } catch (e) {
      console.error('KV write error:', e);
    }
  }

  fallbackStore.set(roomId, current);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
