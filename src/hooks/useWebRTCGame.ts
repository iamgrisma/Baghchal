import { useEffect, useRef, useState } from 'react';
import { GameState, Move, OnlineRoomInfo, PlayerRole } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

interface UseWebRTCGameProps {
  playerName: string;
  onRemoteMove: (move: Move, nextState: GameState) => void;
  onRemoteRestart: () => void;
  onOpponentDisconnected: () => void;
}

export function useWebRTCGame({
  playerName,
  onRemoteMove,
  onRemoteRestart,
  onOpponentDisconnected,
}: UseWebRTCGameProps) {
  const [roomInfo, setRoomInfo] = useState<OnlineRoomInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matchStatusText, setMatchStatusText] = useState('');
  const [dataChannelOpen, setDataChannelOpen] = useState(false);
  const [playerId] = useState(() => `p_${Math.random().toString(36).substring(2, 9)}`);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const queuePollRef = useRef<number | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const roleRef = useRef<PlayerRole | null>(null);
  const isInitiatorRef = useRef(false);

  // Clean up WebRTC and timers
  const cleanupConnection = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
      queuePollRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setDataChannelOpen(false);
    setRoomInfo(null);
    setIsSearching(false);
    currentRoomIdRef.current = null;
    queueIdRef.current = null;
  };

  useEffect(() => {
    return () => cleanupConnection();
  }, []);

  /**
   * Start auto-matchmaking
   */
  const startAutoMatch = async (preferredRole: 'any' | 'tiger' | 'goat' = 'any') => {
    cleanupConnection();
    setIsSearching(true);
    setMatchStatusText('Entering matchmaking queue...');

    try {
      const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName, preferredRole }),
      });
      const data = await res.json();

      if (data.status === 'matched') {
        setupRoom(data.roomId, data.role, data.opponentName, data.isInitiator);
      } else if (data.status === 'waiting') {
        queueIdRef.current = data.queueId;
        setMatchStatusText('Waiting for an opponent to join...');
        pollQueue(data.queueId);
      }
    } catch (err) {
      console.error('Matchmaking failed:', err);
      setIsSearching(false);
      setMatchStatusText('Connection failed. Please try again.');
    }
  };

  /**
   * Poll matchmaking queue
   */
  const pollQueue = (queueId: string) => {
    queuePollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/matchmaking/status/${queueId}`);
        const data = await res.json();

        if (data.status === 'matched') {
          if (queuePollRef.current) clearInterval(queuePollRef.current);
          queuePollRef.current = null;
          setupRoom(data.roomId, data.role, data.opponentName, data.isInitiator);
        } else if (data.status === 'timeout' || data.status === 'expired') {
          if (queuePollRef.current) clearInterval(queuePollRef.current);
          queuePollRef.current = null;
          setIsSearching(false);
          setMatchStatusText('No opponent found. Try again or create a room.');
        }
      } catch (err) {
        console.error('Queue poll error:', err);
      }
    }, 1200);
  };

  /**
   * Cancel matchmaking search
   */
  const cancelAutoMatch = async () => {
    if (queueIdRef.current) {
      try {
        await fetch('/api/matchmaking/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueId: queueIdRef.current }),
        });
      } catch (e) {}
    }
    cleanupConnection();
    setMatchStatusText('Search cancelled.');
  };

  /**
   * Create or Join a private custom room
   */
  const joinCustomRoom = async (roomId: string, asHost: boolean) => {
    cleanupConnection();
    setIsSearching(true);
    setMatchStatusText(asHost ? 'Creating room...' : 'Joining room...');

    const role: PlayerRole = asHost ? 'goat' : 'tiger';
    setupRoom(roomId, role, asHost ? 'Waiting for Friend...' : 'Room Host', asHost);
  };

  /**
   * Setup WebRTC peer connection + KV storage signaling
   */
  const setupRoom = async (
    roomId: string,
    role: PlayerRole,
    opponentName: string,
    isInitiator: boolean
  ) => {
    setIsSearching(false);
    currentRoomIdRef.current = roomId;
    roleRef.current = role;
    isInitiatorRef.current = isInitiator;

    setRoomInfo({
      roomId,
      myRole: role,
      opponentName,
      isInitiator,
      connected: true,
      usingP2P: false,
    });

    setMatchStatusText(`Connected to ${opponentName}! Initializing game...`);

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && currentRoomIdRef.current) {
          fetch(`/api/kv/${currentRoomIdRef.current}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: isInitiator ? 'host' : 'guest',
              candidate: event.candidate,
            }),
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setDataChannelOpen(false);
        }
      };

      if (isInitiator) {
        // Create DataChannel
        const dc = pc.createDataChannel('baghchal-sync', { ordered: true });
        attachDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await fetch(`/api/kv/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer, sender: 'host' }),
        });

        startKVPolling(roomId, pc, true);
      } else {
        // Guest listens for incoming data channel
        pc.ondatachannel = (e) => {
          attachDataChannel(e.channel);
        };

        startKVPolling(roomId, pc, false);
      }
    } catch (err) {
      console.error('WebRTC setup error, falling back to KV sync:', err);
      // Fallback KV polling will handle state sync seamlessly
      startKVPolling(roomId, null, isInitiator);
    }
  };

  /**
   * Attach DataChannel listeners
   */
  const attachDataChannel = (dc: RTCDataChannel) => {
    dcRef.current = dc;

    dc.onopen = () => {
      setDataChannelOpen(true);
      setRoomInfo((prev) => (prev ? { ...prev, usingP2P: true } : null));
    };

    dc.onclose = () => {
      setDataChannelOpen(false);
      setRoomInfo((prev) => (prev ? { ...prev, usingP2P: false } : null));
    };

    dc.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleRemoteMessage(payload);
      } catch (err) {
        console.error('Failed to parse WebRTC message:', err);
      }
    };
  };

  /**
   * Handle incoming remote messages
   */
  const handleRemoteMessage = (msg: any) => {
    if (msg.type === 'move') {
      onRemoteMove(msg.move, msg.state);
    } else if (msg.type === 'restart') {
      onRemoteRestart();
    }
  };

  /**
   * Poll KV storage for WebRTC signaling (Offer/Answer/Candidates) & Game State Fallback
   */
  const startKVPolling = (
    roomId: string,
    pc: RTCPeerConnection | null,
    isInitiator: boolean
  ) => {
    let answerSet = false;
    let offerSet = false;
    let processedCandidates = new Set<string>();
    let lastSeenMoveCount = 0;

    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/kv/${roomId}`);
        const data = await res.json();
        if (!data || data.notFound) return;

        // 1. WebRTC Signaling via KV
        if (pc) {
          if (isInitiator && !answerSet && data.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            answerSet = true;
          } else if (!isInitiator && !offerSet && data.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            offerSet = true;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch(`/api/kv/${roomId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ answer, sender: 'guest' }),
            });
          }

          // Add ICE candidates
          const candidates = isInitiator ? data.candidatesGuest : data.candidatesHost;
          if (candidates && Array.isArray(candidates)) {
            for (const cand of candidates) {
              const str = JSON.stringify(cand);
              if (!processedCandidates.has(str)) {
                processedCandidates.add(str);
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            }
          }
        }

        // 2. Seamless Fallback Game Sync (active if DataChannel is not open)
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
          if (data.gameState && data.gameState.moveHistory) {
            const moveCount = data.gameState.moveHistory.length;
            if (moveCount > lastSeenMoveCount) {
              lastSeenMoveCount = moveCount;
              const lastMove = data.gameState.moveHistory[moveCount - 1];
              // Only trigger if it was from opponent
              if (lastMove && lastMove.piece !== roleRef.current) {
                onRemoteMove(lastMove, data.gameState);
              }
            }
          }
        }
      } catch (err) {
        // transient network error, silently continue polling
      }
    }, 1200);
  };

  /**
   * Broadcast move to remote opponent via WebRTC DataChannel (P2P) + KV fallback
   */
  const sendMove = (move: Move, nextState: GameState) => {
    const payload = { type: 'move', move, state: nextState };

    // 1. Direct WebRTC DataChannel for instant sub-10ms delivery
    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('DataChannel send failed:', err);
      }
    }

    // 2. Also write to KV storage as reliable persistent fallback
    if (currentRoomIdRef.current) {
      fetch(`/api/kv/${currentRoomIdRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState: nextState }),
      }).catch(() => {});
    }
  };

  /**
   * Broadcast game restart
   */
  const sendRestart = () => {
    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify({ type: 'restart' }));
      } catch (err) {}
    }
    if (currentRoomIdRef.current) {
      fetch(`/api/kv/${currentRoomIdRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState: null }),
      }).catch(() => {});
    }
  };

  return {
    roomInfo,
    isSearching,
    matchStatusText,
    dataChannelOpen,
    startAutoMatch,
    cancelAutoMatch,
    joinCustomRoom,
    sendMove,
    sendRestart,
    cleanupConnection,
  };
}
