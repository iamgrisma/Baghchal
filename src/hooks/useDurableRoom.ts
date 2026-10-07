import { useEffect, useRef, useState, useCallback } from 'react';
import { Move, GameState, PlayerRole } from '../types';

interface UseDurableRoomProps {
  roomId: string | null;
  playerId: string;
  playerName: string;
  preferredRole?: 'tiger' | 'goat';
  onRemoteMove: (move: Move, nextState: GameState) => void;
  onRemoteRestart: () => void;
}

export function useDurableRoom({
  roomId,
  playerId,
  playerName,
  preferredRole = 'goat',
  onRemoteMove,
  onRemoteRestart,
}: UseDurableRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [assignedRole, setAssignedRole] = useState<PlayerRole | 'spectator'>('goat');
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/room/${roomId}?playerId=${encodeURIComponent(
      playerId
    )}&name=${encodeURIComponent(playerName)}&role=${preferredRole}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
    } catch (err) {
      console.warn('Durable WebSocket connection skipped:', err);
      return;
    }

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'room_joined') {
          setAssignedRole(data.role);
          const opponent = data.players?.find((p: any) => p.name !== playerName);
          if (opponent) setOpponentName(opponent.name);
        }

        if (data.type === 'player_joined') {
          if (data.name !== playerName) {
            setOpponentName(data.name);
          }
        }

        if (data.type === 'move') {
          onRemoteMove(data.move, data.state);
        }

        if (data.type === 'restart') {
          onRemoteRestart();
        }
      } catch (err) {
        console.error('Error handling room message', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setOpponentName(null);
    };

    return () => {
      try {
        ws.close();
      } catch (e) {}
      socketRef.current = null;
    };
  }, [roomId, playerId, playerName, preferredRole, onRemoteMove, onRemoteRestart]);

  const sendMove = useCallback((move: Move, state: GameState) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'move',
          move,
          state,
        })
      );
    }
  }, []);

  const sendRestart = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'restart',
        })
      );
    }
  }, []);

  return {
    isConnected,
    assignedRole,
    opponentName,
    sendMove,
    sendRestart,
  };
}
