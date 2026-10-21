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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

async function saveInitialRoom(roomId: string, room: any, env: Env): Promise<void> {
  const kv = getKV(env);
  if (kv) {
    try {
      await kv.put(`room:${roomId}`, JSON.stringify(room), { expirationTtl: 7200 });
    } catch (e) {}
  }

  try {
    const cache = caches.default;
    const cacheUrl = new URL(`https://internal-cache.baghchal.local/room/${encodeURIComponent(roomId)}`);
    const response = new Response(JSON.stringify(room), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=7200',
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
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { playerId, playerName, preferredRole } = body;
  if (!playerId || !playerName) {
    return new Response(JSON.stringify({ error: 'playerId and playerName are required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  let queue = await getQueue(context.env);

  // Filter out expired (> 45s)
  queue = queue.filter((p) => now - p.joinedAt < 45000);

  // Find waiting opponent
  const waitingIndex = queue.findIndex(
    (p) => p.playerId !== playerId && !p.matchedRoomId
  );

  if (waitingIndex !== -1) {
    const opponent = queue[waitingIndex];
    const roomId = `room_${Math.random().toString(36).substring(2, 9)}`;

    // Determine roles cleanly and fairly (random by default)
    const oppPref = opponent.preferredRole || 'any';
    const myPref = preferredRole || 'any';
    let hostRole: 'tiger' | 'goat';
    let guestRole: 'tiger' | 'goat';

    if (oppPref === 'tiger' && myPref === 'goat') {
      hostRole = 'tiger';
      guestRole = 'goat';
    } else if (oppPref === 'goat' && myPref === 'tiger') {
      hostRole = 'goat';
      guestRole = 'tiger';
    } else if (oppPref === 'tiger' && myPref === 'any') {
      hostRole = 'tiger';
      guestRole = 'goat';
    } else if (oppPref === 'goat' && myPref === 'any') {
      hostRole = 'goat';
      guestRole = 'tiger';
    } else if (myPref === 'tiger' && oppPref === 'any') {
      hostRole = 'goat';
      guestRole = 'tiger';
    } else if (myPref === 'goat' && oppPref === 'any') {
      hostRole = 'tiger';
      guestRole = 'goat';
    } else {
      // Both requested 'any' or conflicting same role: fair 50/50 coin flip
      const isHostGoat = Math.random() < 0.5;
      hostRole = isHostGoat ? 'goat' : 'tiger';
      guestRole = isHostGoat ? 'tiger' : 'goat';
    }

    opponent.matchedRoomId = roomId;
    opponent.matchedRole = hostRole;
    opponent.opponentName = playerName;
    opponent.isInitiator = true;

    const initialRoom = {
      roomId,
      candidatesHost: [],
      candidatesGuest: [],
      players: {
        hostId: opponent.playerId,
        hostName: opponent.playerName,
        guestId: playerId,
        guestName: playerName,
      },
      lastActive: now,
    };

    await Promise.all([
      saveInitialRoom(roomId, initialRoom, context.env),
      saveQueue(queue, context.env),
    ]);

    return new Response(
      JSON.stringify({
        status: 'matched',
        roomId,
        role: guestRole,
        opponentName: opponent.playerName,
        isInitiator: false,
      }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // Add to queue
  const queueId = `q_${Math.random().toString(36).substring(2, 9)}`;
  const entry: WaitingPlayer = {
    queueId,
    playerId,
    playerName,
    preferredRole: preferredRole || 'any',
    joinedAt: now,
  };
  queue.push(entry);

  await saveQueue(queue, context.env);

  return new Response(
    JSON.stringify({
      status: 'waiting',
      queueId,
    }),
    {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  );
};
