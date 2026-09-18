import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

// In-memory KV store for WebRTC signaling and game state sync
interface RoomKV {
  roomId: string;
  offer?: any;
  answer?: any;
  candidatesHost?: any[];
  candidatesGuest?: any[];
  gameState?: any;
  players?: {
    hostId: string;
    hostName: string;
    guestId?: string;
    guestName?: string;
  };
  lastActive: number;
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

const kvStore = new Map<string, RoomKV>();
const waitingQueue: WaitingPlayer[] = [];

// Cleanup stale rooms & queue entries periodically
setInterval(() => {
  const now = Date.now();
  // Clean rooms idle for > 30 minutes
  for (const [id, room] of kvStore.entries()) {
    if (now - room.lastActive > 30 * 60 * 1000) {
      kvStore.delete(id);
    }
  }
  // Clean queue older than 60 seconds
  for (let i = waitingQueue.length - 1; i >= 0; i--) {
    if (now - waitingQueue[i].joinedAt > 60 * 1000) {
      waitingQueue.splice(i, 1);
    }
  }
}, 30000);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Matchmaking: Join queue or match immediately
app.post('/api/matchmaking/join', (req, res) => {
  const { playerId, playerName, preferredRole } = req.body;
  if (!playerId || !playerName) {
    res.status(400).json({ error: 'playerId and playerName are required' });
    return;
  }

  const now = Date.now();

  // Check if another player is waiting in queue (not self)
  const waitingIndex = waitingQueue.findIndex(
    (p) => p.playerId !== playerId && !p.matchedRoomId && now - p.joinedAt < 45000
  );

  if (waitingIndex !== -1) {
    const opponent = waitingQueue[waitingIndex];
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
      // Random assignment
      const rand = Math.random() > 0.5;
      hostRole = rand ? 'goat' : 'tiger';
      guestRole = rand ? 'tiger' : 'goat';
    }

    // Opponent is initiator/host
    opponent.matchedRoomId = roomId;
    opponent.matchedRole = hostRole;
    opponent.opponentName = playerName;
    opponent.isInitiator = true;

    // Create room in KV
    kvStore.set(roomId, {
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
    });

    res.json({
      status: 'matched',
      roomId,
      role: guestRole,
      opponentName: opponent.playerName,
      isInitiator: false,
    });
    return;
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
  waitingQueue.push(entry);

  res.json({
    status: 'waiting',
    queueId,
  });
});

// Matchmaking: Poll status for queued player
app.get('/api/matchmaking/status/:queueId', (req, res) => {
  const { queueId } = req.params;
  const entry = waitingQueue.find((p) => p.queueId === queueId);

  if (!entry) {
    res.json({ status: 'expired' });
    return;
  }

  if (entry.matchedRoomId) {
    const result = {
      status: 'matched',
      roomId: entry.matchedRoomId,
      role: entry.matchedRole,
      opponentName: entry.opponentName,
      isInitiator: entry.isInitiator,
    };
    // Remove from queue
    const idx = waitingQueue.indexOf(entry);
    if (idx !== -1) waitingQueue.splice(idx, 1);
    res.json(result);
    return;
  }

  if (Date.now() - entry.joinedAt > 60000) {
    res.json({ status: 'timeout' });
    return;
  }

  res.json({ status: 'waiting' });
});

// Matchmaking: Leave queue
app.post('/api/matchmaking/cancel', (req, res) => {
  const { queueId } = req.body;
  const idx = waitingQueue.findIndex((p) => p.queueId === queueId);
  if (idx !== -1) {
    waitingQueue.splice(idx, 1);
  }
  res.json({ ok: true });
});

// Room KV Store: Create or update room data (offer, answer, candidates, fallback gameState)
app.post('/api/kv/:roomId', (req, res) => {
  const { roomId } = req.params;
  const payload = req.body || {};
  const current = kvStore.get(roomId) || {
    roomId,
    candidatesHost: [],
    candidatesGuest: [],
    lastActive: Date.now(),
  };

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

  kvStore.set(roomId, current);
  res.json({ ok: true });
});

// Room KV Store: Read room data
app.get('/api/kv/:roomId', (req, res) => {
  const { roomId } = req.params;
  const data = kvStore.get(roomId);
  if (!data) {
    res.json({ notFound: true });
    return;
  }
  res.json(data);
});

// Start Express Server
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baghchal server listening on port ${PORT}`);
  });
}

start();
