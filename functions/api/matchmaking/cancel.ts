interface Env {
  baghchal_kv?: KVNamespace;
  BAGHCHAL_KV?: KVNamespace;
  KV?: KVNamespace;
  [key: string]: any;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const QUEUE_KEY = 'matchmaking:active_queue';
const memoryQueue: any[] = [];

function getKV(env: Env): KVNamespace | null {
  return env.baghchal_kv || env.BAGHCHAL_KV || env.KV || null;
}

async function getQueue(env: Env): Promise<any[]> {
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

async function saveQueue(queue: any[], env: Env): Promise<void> {
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: any = {};
  try {
    body = await context.request.json();
  } catch (e) {
    body = {};
  }

  const { queueId } = body;

  if (queueId) {
    const queue = await getQueue(context.env);
    const updated = queue.filter((p: any) => p.queueId !== queueId);
    await saveQueue(updated, context.env);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
