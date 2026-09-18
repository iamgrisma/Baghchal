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

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const queuePollRef = useRef<number | null>(null);
  const queueIdRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const roleRef = useRef<PlayerRole | null>(null);
  const isInitiatorRef = useRef(false);
  const lastSeenMoveCountRef = useRef(0);

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
      try {
        dcRef.current.close();
      } catch (e) {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    setDataChannelOpen(false);
    setRoomInfo(null);
    setIsSearching(false);
    currentRoomIdRef.current = null;
    queueIdRef.current = null;
    roleRef.current = null;
    lastSeenMoveCountRef.current = 0;
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
        body: JSON.stringify({ playerId, playerName: playerNameRef.current, preferredRole }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'matched') {
        setupRoom(data.roomId, data.role, data.opponentName, data.isInitiator, true);
      } else if (data.status === 'waiting') {
        queueIdRef.current = data.queueId;
        setMatchStatusText('Waiting for an opponent to join...');
        pollQueue(data.queueId);
      }
    } catch (err: any) {
      console.error('Matchmaking failed:', err);
      setIsSearching(false);
      setMatchStatusText('Matchmaking service unavailable. You can still create a private room!');
    }
  };

  /**
   * Poll matchmaking queue
   */
  const pollQueue = (queueId: string) => {
    queuePollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/matchmaking/status/${queueId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === 'matched') {
          if (queuePollRef.current) clearInterval(queuePollRef.current);
          queuePollRef.current = null;
          setupRoom(data.roomId, data.role, data.opponentName, data.isInitiator, true);
        } else if (data.status === 'timeout' || data.status === 'expired') {
          if (queuePollRef.current) clearInterval(queuePollRef.current);
          queuePollRef.current = null;
          setIsSearching(false);
          setMatchStatusText('No opponent found. Create a private room or try again.');
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
    setIsSearching(false);
    setMatchStatusText(asHost ? 'Creating private room...' : 'Joining room...');

    const role: PlayerRole = asHost ? 'goat' : 'tiger';
    setupRoom(roomId, role, asHost ? 'Waiting for Friend...' : 'Room Host', asHost, !asHost);
  };

  /**
   * Setup WebRTC peer connection + KV/Edge signaling
   */
  const setupRoom = async (
    roomId: string,
    role: PlayerRole,
    opponentName: string,
    isInitiator: boolean,
    isInitiallyConnected = false
  ) => {
    setIsSearching(false);
    currentRoomIdRef.current = roomId;
    roleRef.current = role;
    isInitiatorRef.current = isInitiator;
    lastSeenMoveCountRef.current = 0;

    setRoomInfo({
      roomId,
      myRole: role,
      opponentName,
      isInitiator,
      connected: isInitiallyConnected,
      usingP2P: false,
    });

    if (isInitiallyConnected) {
      setMatchStatusText(`Connected to ${opponentName}! Initializing match...`);
    } else {
      setMatchStatusText('Waiting for friend to join with room code...');
    }

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
        if (pc.connectionState === 'connected') {
          setRoomInfo((prev) => (prev ? { ...prev, connected: true } : null));
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setDataChannelOpen(false);
          setRoomInfo((prev) => (prev ? { ...prev, usingP2P: false } : null));
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
          body: JSON.stringify({
            offer,
            sender: 'host',
            players: { host: playerNameRef.current },
            gameState: null,
          }),
        });

        startKVPolling(roomId, pc, true);
      } else {
        // Guest listens for incoming data channel
        pc.ondatachannel = (e) => {
          attachDataChannel(e.channel);
        };

        // Notify room that guest has joined
        fetch(`/api/kv/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: 'guest',
            players: { guest: playerNameRef.current },
          }),
        }).catch(() => {});

        startKVPolling(roomId, pc, false);
      }
    } catch (err) {
      console.error('WebRTC setup error, falling back to Cloudflare Edge sync:', err);
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
      setRoomInfo((prev) => (prev ? { ...prev, connected: true, usingP2P: true } : null));
      setMatchStatusText('Connected via Direct P2P (Sub-10ms Latency)!');
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
      if (msg.state?.moveHistory) {
        lastSeenMoveCountRef.current = msg.state.moveHistory.length;
      }
      onRemoteMove(msg.move, msg.state);
    } else if (msg.type === 'restart') {
      lastSeenMoveCountRef.current = 0;
      onRemoteRestart();
    }
  };

  /**
   * Poll Cloudflare Edge / KV storage for WebRTC signaling (Offer/Answer/Candidates) & Game State Sync
   */
  const startKVPolling = (
    roomId: string,
    pc: RTCPeerConnection | null,
    isInitiator: boolean
  ) => {
    let answerSet = false;
    let offerSet = false;
    const processedCandidates = new Set<string>();

    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/kv/${roomId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!data || data.notFound) return;

        // 1. Detect Opponent Connection & Player Names
        if (data.players) {
          const remoteName = isInitiator ? data.players.guest : data.players.host;
          if (remoteName) {
            setRoomInfo((prev) => {
              if (!prev) return null;
              if (prev.opponentName !== remoteName || !prev.connected) {
                return { ...prev, opponentName: remoteName, connected: true };
              }
              return prev;
            });
            setMatchStatusText(`Connected to ${remoteName}! Match in progress.`);
          }
        }

        // 2. WebRTC Signaling via Cloudflare Edge Store
        if (pc) {
          if (isInitiator && !answerSet && data.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            answerSet = true;
            setRoomInfo((prev) => (prev ? { ...prev, connected: true } : null));
          } else if (!isInitiator && !offerSet && data.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            offerSet = true;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch(`/api/kv/${roomId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                answer,
                sender: 'guest',
                players: { guest: playerNameRef.current },
              }),
            });
            setRoomInfo((prev) => (prev ? { ...prev, connected: true } : null));
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

        // 3. Seamless Fallback Game Sync (active if DataChannel is not open)
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
          if (data.gameState && data.gameState.moveHistory) {
            const moveCount = data.gameState.moveHistory.length;
            if (moveCount > lastSeenMoveCountRef.current) {
              lastSeenMoveCountRef.current = moveCount;
              const lastMove = data.gameState.moveHistory[moveCount - 1];
              // Only trigger if it was from opponent
              if (lastMove && lastMove.piece !== roleRef.current) {
                onRemoteMove(lastMove, data.gameState);
              }
            }
          } else if (data.gameState === null && lastSeenMoveCountRef.current > 0) {
            lastSeenMoveCountRef.current = 0;
            onRemoteRestart();
          }
        }
      } catch (err) {
        // Transient network glitch, silently continue polling
      }
    }, 1200);
  };

  /**
   * Broadcast move to remote opponent via WebRTC DataChannel (P2P) + Cloudflare Edge fallback
   */
  const sendMove = (move: Move, nextState: GameState) => {
    if (nextState?.moveHistory) {
      lastSeenMoveCountRef.current = nextState.moveHistory.length;
    }

    const payload = { type: 'move', move, state: nextState };

    // 1. Direct WebRTC DataChannel for instant sub-10ms delivery
    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('DataChannel send failed:', err);
      }
    }

    // 2. Persistent Cloudflare Edge sync fallback
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
    lastSeenMoveCountRef.current = 0;

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
