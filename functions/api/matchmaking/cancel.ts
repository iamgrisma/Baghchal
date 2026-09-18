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

function getKV(env: Env): KVNamespace | null {
  return env.baghchal_kv || env.BAGHCHAL_KV || env.KV || null;
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
  const kv = getKV(context.env);

  if (queueId && kv) {
    try {
      const raw = await kv.get(QUEUE_KEY);
      if (raw) {
        const queue = JSON.parse(raw);
        const updated = queue.filter((p: any) => p.queueId !== queueId);
        await kv.put(QUEUE_KEY, JSON.stringify(updated), { expirationTtl: 120 });
      }
    } catch (e) {}
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
};
