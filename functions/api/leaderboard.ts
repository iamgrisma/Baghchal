interface Env {
  LEADERBOARD_STORE?: DurableObjectNamespace;
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

// Global in-memory fallback store
const fallbackLeaderboard: any[] = [
  {
    id: 'p_grisma',
    name: 'Grisma',
    rating: 1520,
    wins: 12,
    losses: 2,
    tigersTrapped: 8,
    goatsCaptured: 20,
    updatedAt: Date.now(),
  },
  {
    id: 'p_bot_master',
    name: 'Baghchal Bot (Master)',
    rating: 1450,
    wins: 10,
    losses: 4,
    tigersTrapped: 3,
    goatsCaptured: 32,
    updatedAt: Date.now() - 100000,
  },
];

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // 1. Delegate to Durable Object if bound
  if (context.env.LEADERBOARD_STORE) {
    try {
      const id = context.env.LEADERBOARD_STORE.idFromName('global_leaderboard');
      const obj = context.env.LEADERBOARD_STORE.get(id);
      const res = await obj.fetch(context.request);
      const response = new Response(res.body, res);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (e) {
      console.warn('DO Leaderboard fetch error:', e);
    }
  }

  // 2. Read from KV if bound
  const kv = context.env.baghchal_kv || context.env.BAGHCHAL_KV || context.env.KV;
  if (kv) {
    try {
      const raw = await kv.get('leaderboard:global');
      if (raw) {
        return new Response(raw, {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {}
  }

  // 3. Fallback to in-memory list
  return new Response(JSON.stringify(fallbackLeaderboard), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  // 1. Delegate to Durable Object if bound
  if (context.env.LEADERBOARD_STORE) {
    try {
      const id = context.env.LEADERBOARD_STORE.idFromName('global_leaderboard');
      const obj = context.env.LEADERBOARD_STORE.get(id);
      const res = await obj.fetch(context.request);
      const response = new Response(res.body, res);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (e) {
      console.warn('DO Leaderboard post error:', e);
    }
  }

  let body: any = {};
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { winnerId, winnerName, loserId, loserName, winnerRole, goatsEaten } = body;
  if (!winnerId || !winnerName) {
    return new Response(JSON.stringify({ error: 'winnerId and winnerName required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  let existingIndex = fallbackLeaderboard.findIndex((p) => p.id === winnerId);
  if (existingIndex !== -1) {
    fallbackLeaderboard[existingIndex].wins += 1;
    fallbackLeaderboard[existingIndex].rating += 25;
    if (winnerRole === 'tiger') fallbackLeaderboard[existingIndex].goatsCaptured += goatsEaten || 0;
    else fallbackLeaderboard[existingIndex].tigersTrapped += 1;
    fallbackLeaderboard[existingIndex].updatedAt = now;
  } else {
    fallbackLeaderboard.push({
      id: winnerId,
      name: winnerName,
      rating: 1225,
      wins: 1,
      losses: 0,
      tigersTrapped: winnerRole === 'goat' ? 1 : 0,
      goatsCaptured: winnerRole === 'tiger' ? (goatsEaten || 0) : 0,
      updatedAt: now,
    });
  }

  fallbackLeaderboard.sort((a, b) => b.rating - a.rating);

  const kv = context.env.baghchal_kv || context.env.BAGHCHAL_KV || context.env.KV;
  if (kv) {
    try {
      await kv.put('leaderboard:global', JSON.stringify(fallbackLeaderboard));
    } catch (e) {}
  }

  return new Response(JSON.stringify({ success: true, count: fallbackLeaderboard.length }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
