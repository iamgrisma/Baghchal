interface Env {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  [key: string]: any;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT_REDIS_URL = 'https://helpful-giraffe-305470.upstash.io';
const DEFAULT_REDIS_TOKEN = 'gQAAAAAABKk-AAIgcDEwOWMwN2EwNDZmNzU0NDBlYmVmMTAxNjc1Y2MwNGM5Zg';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const url = context.env.UPSTASH_REDIS_REST_URL || DEFAULT_REDIS_URL;
  const token = context.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_REDIS_TOKEN;

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { roomId, action, sender, payload } = body;
  if (!roomId || !action) {
    return new Response(JSON.stringify({ error: 'Missing roomId or action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const safeRoom = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const redisKey = `baghchal:sig:${safeRoom}`;

  try {
    if (action === 'publish') {
      const msgItem = JSON.stringify({ sender, payload, ts: Date.now() });
      const pipelineRes = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['RPUSH', redisKey, msgItem],
          ['EXPIRE', redisKey, 60],
        ]),
      });
      const data = await pipelineRes.json();
      return new Response(JSON.stringify({ success: true, result: data }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'poll') {
      const lrangeRes = await fetch(`${url}/lrange/${redisKey}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resData: any = await lrangeRes.json();
      const rawList = Array.isArray(resData?.result) ? resData.result : [];

      const messages = rawList
        .map((entry: string) => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter((item: any) => item && item.sender !== sender);

      return new Response(JSON.stringify({ messages }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unsupported action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Upstash Redis error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};
