export interface Env {
  BAGHCHAL_ROOM: DurableObjectNamespace;
  LEADERBOARD_STORE: DurableObjectNamespace;
}

// ----------------------------------------------------
// 1. BaghchalRoom Durable Object (Realtime WebSockets)
// ----------------------------------------------------
export class BaghchalRoom {
  state: DurableObjectState;
  sessions: Map<WebSocket, { playerId: string; name: string; role: 'tiger' | 'goat' | 'spectator' }>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const playerId = url.searchParams.get('playerId') || `p_${Math.random().toString(36).substring(2, 8)}`;
      const name = url.searchParams.get('name') || 'Player';
      const requestedRole = url.searchParams.get('role') as 'tiger' | 'goat' | null;

      await this.handleWebSocketSession(server, playerId, name, requestedRole);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Expected WebSocket upgrade connection', { status: 400 });
  }

  async handleWebSocketSession(
    ws: WebSocket,
    playerId: string,
    name: string,
    requestedRole: 'tiger' | 'goat' | null
  ) {
    ws.accept();

    let assignedRole: 'tiger' | 'goat' | 'spectator' = 'spectator';
    const currentRoles = Array.from(this.sessions.values()).map((s) => s.role);

    if (requestedRole && !currentRoles.includes(requestedRole)) {
      assignedRole = requestedRole;
    } else if (!currentRoles.includes('goat')) {
      assignedRole = 'goat';
    } else if (!currentRoles.includes('tiger')) {
      assignedRole = 'tiger';
    }

    this.sessions.set(ws, { playerId, name, role: assignedRole });

    ws.send(
      JSON.stringify({
        type: 'room_joined',
        role: assignedRole,
        playerId,
        players: Array.from(this.sessions.values()).map((p) => ({
          name: p.name,
          role: p.role,
        })),
      })
    );

    this.broadcast(
      JSON.stringify({
        type: 'player_joined',
        name,
        role: assignedRole,
      }),
      ws
    );

    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        const senderInfo = this.sessions.get(ws);

        this.broadcast(
          JSON.stringify({
            ...data,
            sender: senderInfo?.role || 'spectator',
            senderName: senderInfo?.name,
          }),
          ws
        );
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    });

    ws.addEventListener('close', () => {
      const exiting = this.sessions.get(ws);
      this.sessions.delete(ws);
      if (exiting) {
        this.broadcast(
          JSON.stringify({
            type: 'player_left',
            role: exiting.role,
            name: exiting.name,
          })
        );
      }
    });
  }

  broadcast(message: string, senderWs?: WebSocket) {
    for (const [socket] of this.sessions.entries()) {
      if (socket !== senderWs) {
        try {
          socket.send(message);
        } catch (e) {
          this.sessions.delete(socket);
        }
      }
    }
  }
}

// ----------------------------------------------------
// 2. LeaderboardStore Durable Object (Persistent Ranking)
// ----------------------------------------------------
export interface PlayerRecord {
  id: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  tigersTrapped: number;
  goatsCaptured: number;
  updatedAt: number;
}

export class LeaderboardStore {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const records = (await this.state.storage.get<Record<string, PlayerRecord>>('players')) || {};
      const sorted = Object.values(records)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 50);

      return new Response(JSON.stringify(sorted), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as {
        winnerId: string;
        winnerName: string;
        loserId: string;
        loserName: string;
        winnerRole: 'tiger' | 'goat';
        goatsEaten: number;
      };

      const records = (await this.state.storage.get<Record<string, PlayerRecord>>('players')) || {};
      const now = Date.now();

      const winner = records[body.winnerId] || {
        id: body.winnerId,
        name: body.winnerName,
        rating: 1200,
        wins: 0,
        losses: 0,
        tigersTrapped: 0,
        goatsCaptured: 0,
        updatedAt: now,
      };

      const loser = records[body.loserId] || {
        id: body.loserId,
        name: body.loserName,
        rating: 1200,
        wins: 0,
        losses: 0,
        tigersTrapped: 0,
        goatsCaptured: 0,
        updatedAt: now,
      };

      const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
      const expectedLoser = 1 / (1 + Math.pow(10, (winner.rating - loser.rating) / 400));
      const kFactor = 32;

      winner.rating = Math.round(winner.rating + kFactor * (1 - expectedWinner));
      loser.rating = Math.max(100, Math.round(loser.rating + kFactor * (0 - expectedLoser)));

      winner.wins += 1;
      loser.losses += 1;

      if (body.winnerRole === 'tiger') {
        winner.goatsCaptured += body.goatsEaten || 0;
      } else {
        winner.tigersTrapped += 1;
      }

      winner.name = body.winnerName;
      loser.name = body.loserName;
      winner.updatedAt = now;
      loser.updatedAt = now;

      records[body.winnerId] = winner;
      records[body.loserId] = loser;

      await this.state.storage.put('players', records);

      return new Response(JSON.stringify({ success: true, winner, loser }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

// ----------------------------------------------------
// 3. Worker Gateway Router
// ----------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 1. Global Leaderboard Endpoint
    if (url.pathname.startsWith('/api/leaderboard')) {
      const id = env.LEADERBOARD_STORE.idFromName('global_leaderboard');
      const leaderboardDO = env.LEADERBOARD_STORE.get(id);
      const res = await leaderboardDO.fetch(request);
      const response = new Response(res.body, res);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // 2. Realtime Match Room Endpoint: /api/room/:roomId
    const match = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const roomId = match[1];
      const id = env.BAGHCHAL_ROOM.idFromName(roomId);
      const roomDO = env.BAGHCHAL_ROOM.get(id);
      return roomDO.fetch(request);
    }

    return new Response('Baghchal Edge Durable Service Active', { status: 200 });
  },
};
