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
const inMemoryQueue: WaitingPlayer[] = [];

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

  const kv = getKV(context.env);
  const now = Date.now();

  let queue: WaitingPlayer[] = [];
  if (kv) {
    try {
      const raw = await kv.get(QUEUE_KEY);
      if (raw) queue = JSON.parse(raw);
    } catch (e) {}
  } else {
    queue = [...inMemoryQueue];
  }

  // Filter out expired items (> 45s) or own stale items
  queue = queue.filter((p) => now - p.joinedAt < 45000);

  // Find an opponent waiting in queue (not self, and not already matched)
  const waitingIndex = queue.findIndex(
    (p) => p.playerId !== playerId && !p.matchedRoomId
  );

  if (waitingIndex !== -1) {
    const opponent = queue[waitingIndex];
    const roomId = `room_${Math.random().toString(36).substring(2, 9)}`;

    // Determine roles
    let hostRole: 'tiger' | 'goat';
    let guestRole: 'tiger' | 'goat';

    if (opponent.preferredRole === 'tiger' || preferredRole === 'goat') {
      hostRole = 'tiger';
      guestRole = 'goat';
    } else if (opponent.preferredRole === 'goat' || preferredRole === 'tiger') {
      hostRole = 'goat';
      guestRole = 'tiger';
    } else {
      const rand = Math.random() > 0.5;
      hostRole = rand ? 'goat' : 'tiger';
      guestRole = rand ? 'tiger' : 'goat';
    }

    // Mark opponent as matched
    opponent.matchedRoomId = roomId;
    opponent.matchedRole = hostRole;
    opponent.opponentName = playerName;
    opponent.isInitiator = true;

    // Create room in KV
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

    if (kv) {
      try {
        await Promise.all([
          kv.put(`room:${roomId}`, JSON.stringify(initialRoom), { expirationTtl: 7200 }),
          kv.put(QUEUE_KEY, JSON.stringify(queue), { expirationTtl: 120 }),
        ]);
      } catch (e) {
        console.error('KV matchmaking save error:', e);
      }
    }

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

  // No opponent immediately available: add to queue
  const queueId = `q_${Math.random().toString(36).substring(2, 9)}`;
  const entry: WaitingPlayer = {
    queueId,
    playerId,
    playerName,
    preferredRole: preferredRole || 'any',
    joinedAt: now,
  };
  queue.push(entry);

  if (kv) {
    try {
      await kv.put(QUEUE_KEY, JSON.stringify(queue), { expirationTtl: 120 });
    } catch (e) {}
  } else {
    inMemoryQueue.length = 0;
    inMemoryQueue.push(...queue);
  }

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
