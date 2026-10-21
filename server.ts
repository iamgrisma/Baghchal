import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
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
  const body = req.body || {};
  const sender = body.sender || 'unknown';
  const innerPayload = body.payload || body;

  const current: any = kvStore.get(roomId) || {
    roomId,
    candidatesHost: [],
    candidatesGuest: [],
    messages: [],
    lastActive: Date.now(),
  };

  current.lastActive = Date.now();
  current.messages = current.messages || [];

  if (innerPayload && Object.keys(innerPayload).length > 0) {
    current.messages.push({
      sender,
      payload: innerPayload,
      ts: Date.now(),
    });
    if (current.messages.length > 40) {
      current.messages = current.messages.slice(-40);
    }
  }

  if (innerPayload.offer) current.offer = innerPayload.offer;
  if (innerPayload.answer) current.answer = innerPayload.answer;
  if (innerPayload.candidate) {
    if (sender === 'host' || innerPayload.sender === 'host') {
      current.candidatesHost = current.candidatesHost || [];
      current.candidatesHost.push(innerPayload.candidate);
    } else {
      current.candidatesGuest = current.candidatesGuest || [];
      current.candidatesGuest.push(innerPayload.candidate);
    }
  }
  if (innerPayload.gameState) {
    current.gameState = innerPayload.gameState;
  }
  if (innerPayload.players) {
    current.players = { ...current.players, ...innerPayload.players };
  }

  kvStore.set(roomId, current);
  res.json({ ok: true });
});

// Room KV Store: Read room data
app.get('/api/kv/:roomId', (req, res) => {
  const { roomId } = req.params;
  const data = kvStore.get(roomId);
  if (!data) {
    res.json({ notFound: true, messages: [] });
    return;
  }
  res.json(data);
});

// Global Leaderboard Endpoints
const serverLeaderboard: any[] = [];

app.get('/api/leaderboard', (req, res) => {
  res.json(serverLeaderboard);
});

app.post('/api/leaderboard', (req, res) => {
  const { winnerId, winnerName, loserId, loserName, winnerRole, goatsEaten } = req.body || {};
  if (!winnerId || !winnerName) {
    res.status(400).json({ error: 'winnerId and winnerName required' });
    return;
  }
  const now = Date.now();
  let existing = serverLeaderboard.find((p) => p.id === winnerId);
  if (existing) {
    existing.wins += 1;
    existing.rating += 25;
    if (winnerRole === 'tiger') existing.goatsCaptured += (goatsEaten || 0);
    else existing.tigersTrapped += 1;
    existing.updatedAt = now;
  } else {
    serverLeaderboard.push({
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

  if (loserId && loserName) {
    let existingLoser = serverLeaderboard.find((p) => p.id === loserId);
    if (existingLoser) {
      existingLoser.losses += 1;
      existingLoser.rating = Math.max(1000, existingLoser.rating - 15);
      existingLoser.updatedAt = now;
    } else {
      serverLeaderboard.push({
        id: loserId,
        name: loserName,
        rating: 1185,
        wins: 0,
        losses: 1,
        tigersTrapped: 0,
        goatsCaptured: 0,
        updatedAt: now,
      });
    }
  }

  serverLeaderboard.sort((a, b) => b.rating - a.rating);
  res.json({ success: true, count: serverLeaderboard.length });
});

// Start Express Server
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Baghchal server listening on port ${PORT}`);
  });
}

start();
