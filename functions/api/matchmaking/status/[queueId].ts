interface Env {
  baghchal_kv?: KVNamespace;
  BAGHCHAL_KV?: KVNamespace;
  KV?: KVNamespace;
  [key: string]: any;
}

interface WaitingPlayer {
  queueId: string;
  playerId: string;
  playerName: string;
  preferredRole: 'any' | 'tiger' | 'goat';
  joinedAt: number;
  matchedRoomId?: string;
  matchedRole?: 'tiger' | 'goat';
  opponentName?: string;
  isInitiator?: boolean;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const QUEUE_KEY = 'matchmaking:active_queue';
const memoryQueue: WaitingPlayer[] = [];

function getKV(env: Env): KVNamespace | null {
  return env.baghchal_kv || env.BAGHCHAL_KV || env.KV || null;
}

async function getQueue(env: Env): Promise<WaitingPlayer[]> {
  const kv = getKV(env);
  if (kv) {
    try {
      const raw = await kv.get(QUEUE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }

  try {
    const cache = caches.default;
    const cacheUrl = new URL(`https://internal-cache.baghchal.local/matchmaking/queue`);
    const match = await cache.match(cacheUrl);
    if (match) return await match.json();
  } catch (e) {}

  return [...memoryQueue];
}

async function saveQueue(queue: WaitingPlayer[], env: Env): Promise<void> {
  memoryQueue.length = 0;
  memoryQueue.push(...queue);

  const kv = getKV(env);
  if (kv) {
    try {
      await kv.put(QUEUE_KEY, JSON.stringify(queue), { expirationTtl: 120 });
    } catch (e) {}
  }

  try {
    const cache = caches.default;
    const cacheUrl = new URL(`https://internal-cache.baghchal.local/matchmaking/queue`);
    const response = new Response(JSON.stringify(queue), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
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
  const queueId = context.params.queueId as string;
  if (!queueId) {
    return new Response(JSON.stringify({ status: 'expired' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const queue = await getQueue(context.env);
  const entry = queue.find((p) => p.queueId === queueId);
  if (!entry) {
    return new Response(JSON.stringify({ status: 'expired' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // If matched
  if (entry.matchedRoomId) {
    const result = {
      status: 'matched',
      roomId: entry.matchedRoomId,
      role: entry.matchedRole,
      opponentName: entry.opponentName,
      isInitiator: entry.isInitiator,
    };

    // Remove from queue in store
    const updatedQueue = queue.filter((p) => p.queueId !== queueId);
    await saveQueue(updatedQueue, context.env);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Timeout after 60s
  if (Date.now() - entry.joinedAt > 60000) {
    return new Response(JSON.stringify({ status: 'timeout' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ status: 'waiting' }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
