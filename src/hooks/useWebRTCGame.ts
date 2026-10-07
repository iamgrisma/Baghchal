import { useEffect, useRef, useState, useCallback } from 'react';
import { Move, GameState, PlayerRole, OnlineRoomInfo } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const NTFY_BASE = 'https://ntfy.sh';
const NTFY_WS_BASE = 'wss://ntfy.sh';
const MATCHMAKING_TOPIC = 'baghchal_matchmaking_v2';

interface UseWebRTCGameProps {
  playerName: string;
  gameState?: GameState;
  onRemoteMove: (move: Move, nextState: GameState) => void;
  onRemoteRestart: () => void;
  onOpponentForfeitWin?: () => void;
}

export function useWebRTCGame({
  playerName,
  gameState,
  onRemoteMove,
  onRemoteRestart,
  onOpponentForfeitWin,
}: UseWebRTCGameProps) {
  const [roomInfo, setRoomInfo] = useState<OnlineRoomInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matchStatusText, setMatchStatusText] = useState('Select a mode to play');
  const [dataChannelOpen, setDataChannelOpen] = useState(false);
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState(30);
  const [playerId] = useState(() => `p_${Math.random().toString(36).substring(2, 9)}`);

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const currentGameStateRef = useRef<GameState | undefined>(gameState);
  currentGameStateRef.current = gameState;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const roomWsRef = useRef<WebSocket | null>(null);
  const matchWsRef = useRef<WebSocket | null>(null);
  const matchSeekIntervalRef = useRef<number | null>(null);
  const matchTimeoutRef = useRef<number | null>(null);
  const redisPollIntervalRef = useRef<number | null>(null);
  const forfeitCountdownRef = useRef<number | null>(null);

  const currentRoomIdRef = useRef<string | null>(null);
  const roleRef = useRef<PlayerRole | null>(null);
  const isInitiatorRef = useRef(false);
  const localOfferRef = useRef<any>(null);
  const lastSeenMoveCountRef = useRef(0);

  const getCleanTopic = (roomId: string) => {
    const clean = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `baghchal_rm_${clean}`;
  };

  const publishToTopic = async (topic: string, data: any) => {
    // 1. Primary: Fast Realtime PubSub
    try {
      fetch(`${NTFY_BASE}/${topic}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    } catch (e) {}

    // 2. Secondary Fallback: Upstash Redis
    if (currentRoomIdRef.current) {
      try {
        fetch('/api/signaling/redis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: currentRoomIdRef.current,
            action: 'publish',
            sender: isInitiatorRef.current ? 'host' : 'guest',
            payload: data,
          }),
        }).catch(() => {});
      } catch (e) {}
    }
  };

  // 30-Second Forfeit Countdown Management
  const startForfeitCountdown = useCallback(() => {
    if (forfeitCountdownRef.current) return;
    setIsOpponentDisconnected(true);
    setDisconnectSecondsLeft(30);

    forfeitCountdownRef.current = window.setInterval(() => {
      setDisconnectSecondsLeft((prev) => {
        if (prev <= 1) {
          if (forfeitCountdownRef.current) {
            clearInterval(forfeitCountdownRef.current);
            forfeitCountdownRef.current = null;
          }
          setIsOpponentDisconnected(false);
          setMatchStatusText('Opponent forfeited after 30s disconnection. You win!');
          onOpponentForfeitWin?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onOpponentForfeitWin]);

  const cancelForfeitCountdown = useCallback(() => {
    setIsOpponentDisconnected(false);
    setDisconnectSecondsLeft(30);
    if (forfeitCountdownRef.current) {
      clearInterval(forfeitCountdownRef.current);
      forfeitCountdownRef.current = null;
    }
  }, []);

  // Clean up WebRTC, WebSockets, Redis polling, and timers
  const cleanupConnection = () => {
    cancelForfeitCountdown();
    if (matchSeekIntervalRef.current) {
      clearInterval(matchSeekIntervalRef.current);
      matchSeekIntervalRef.current = null;
    }
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    if (redisPollIntervalRef.current) {
      clearInterval(redisPollIntervalRef.current);
      redisPollIntervalRef.current = null;
    }
    if (matchWsRef.current) {
      try {
        matchWsRef.current.close();
      } catch (e) {}
      matchWsRef.current = null;
    }
    if (roomWsRef.current) {
      try {
        roomWsRef.current.close();
      } catch (e) {}
      roomWsRef.current = null;
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
    roleRef.current = null;
    localOfferRef.current = null;
    lastSeenMoveCountRef.current = 0;
  };

  useEffect(() => {
    return () => cleanupConnection();
  }, []);

  /**
   * 1. AUTO MATCHMAKING (Global Realtime PubSub)
   */
  const startAutoMatch = async (preferredRole: 'any' | 'tiger' | 'goat' = 'any') => {
    cleanupConnection();
    setIsSearching(true);
    setMatchStatusText('Connecting to matchmaking lobby...');

    try {
      const ws = new WebSocket(`${NTFY_WS_BASE}/${MATCHMAKING_TOPIC}/ws`);
      matchWsRef.current = ws;

      const myJoinTime = Date.now();

      ws.onopen = () => {
        setMatchStatusText('Searching for an opponent...');

        const seekPacket = {
          type: 'seek',
          playerId,
          playerName: playerNameRef.current,
          preferredRole,
          timestamp: myJoinTime,
        };
        publishToTopic(MATCHMAKING_TOPIC, seekPacket);

        matchSeekIntervalRef.current = window.setInterval(() => {
          publishToTopic(MATCHMAKING_TOPIC, seekPacket);
        }, 2500);

        matchTimeoutRef.current = window.setTimeout(() => {
          if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
          setIsSearching(false);
          setMatchStatusText('No opponent found right now. Try creating a private room!');
        }, 45000);
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.event !== 'message') return;
          const msg = JSON.parse(envelope.message);

          if (msg.type === 'seek' && msg.playerId !== playerId) {
            if (myJoinTime > msg.timestamp || (myJoinTime === msg.timestamp && playerId > msg.playerId)) {
              const code = Math.random().toString(36).substring(2, 7).toUpperCase();
              const roomId = `bc_${code}`;

              let roleForSeeker: PlayerRole;
              let roleForMe: PlayerRole;

              if (msg.preferredRole === 'tiger' || preferredRole === 'goat') {
                roleForSeeker = 'tiger';
                roleForMe = 'goat';
              } else if (msg.preferredRole === 'goat' || preferredRole === 'tiger') {
                roleForSeeker = 'goat';
                roleForMe = 'tiger';
              } else {
                roleForSeeker = 'goat';
                roleForMe = 'tiger';
              }

              publishToTopic(MATCHMAKING_TOPIC, {
                type: 'match_found',
                seekerId: msg.playerId,
                proposerId: playerId,
                roomId,
                roleSeeker: roleForSeeker,
                roleProposer: roleForMe,
                nameSeeker: msg.playerName,
                nameProposer: playerNameRef.current,
              });

              if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
              if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
              if (matchWsRef.current) matchWsRef.current.close();
              matchWsRef.current = null;

              setupRoom(roomId, roleForMe, msg.playerName, roleForMe === 'goat', true);
            }
          }

          if (msg.type === 'match_found' && msg.seekerId === playerId) {
            if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
            if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
            if (matchWsRef.current) matchWsRef.current.close();
            matchWsRef.current = null;

            setupRoom(
              msg.roomId,
              msg.roleSeeker,
              msg.nameProposer,
              msg.roleSeeker === 'goat',
              true
            );
          }
        } catch (e) {}
      };

      ws.onerror = () => {
        setMatchStatusText('Connection error. You can still create a private room.');
      };
    } catch (err) {
      setIsSearching(false);
      setMatchStatusText('Failed to connect to matchmaking. Try a private room.');
    }
  };

  const cancelAutoMatch = () => {
    cleanupConnection();
    setMatchStatusText('Search cancelled.');
  };

  /**
   * 2. PRIVATE CUSTOM ROOM
   */
  const joinCustomRoom = async (roomId: string, asHost: boolean) => {
    cleanupConnection();
    setIsSearching(false);
    setMatchStatusText(asHost ? 'Creating private room...' : 'Joining room...');

    const role: PlayerRole = asHost ? 'goat' : 'tiger';
    setupRoom(roomId, role, asHost ? 'Waiting for Friend...' : 'Room Host', asHost, !asHost);
  };

  /**
   * 3. ROOM SETUP & WEBRTC P2P + MULTI-TIER SIGNALING
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

    setRoomInfo({
      roomId,
      myRole: role,
      opponentName,
      isInitiator,
      connected: isInitiallyConnected,
      usingP2P: false,
    });

    if (isInitiallyConnected) {
      setMatchStatusText(`Connected to ${opponentName}! Initializing game...`);
    } else {
      setMatchStatusText('Waiting for friend to join with room code...');
    }

    const roomTopic = getCleanTopic(roomId);

    // 1. Realtime Primary WebSocket
    const ws = new WebSocket(`${NTFY_WS_BASE}/${roomTopic}/ws`);
    roomWsRef.current = ws;

    // 2. Upstash Redis Fallback Polling (polls every 2.5s)
    redisPollIntervalRef.current = window.setInterval(async () => {
      if (dcRef.current && dcRef.current.readyState === 'open') return;
      try {
        const res = await fetch('/api/signaling/redis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            action: 'poll',
            sender: isInitiator ? 'host' : 'guest',
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        for (const msgItem of data.messages || []) {
          handleIncomingSignal(msgItem.payload);
        }
      } catch (e) {}
    }, 2500);

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          publishToTopic(roomTopic, {
            type: 'candidate',
            sender: isInitiator ? 'host' : 'guest',
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setDataChannelOpen(true);
          cancelForfeitCountdown();
          setRoomInfo((prev) => (prev ? { ...prev, connected: true, usingP2P: true } : null));
          setMatchStatusText('Direct P2P WebRTC Connected (<10ms)!');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setDataChannelOpen(false);
          startForfeitCountdown();
          setRoomInfo((prev) => (prev ? { ...prev, usingP2P: false } : null));
        }
      };

      if (isInitiator) {
        const dc = pc.createDataChannel('baghchal-sync', { ordered: true });
        attachDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        localOfferRef.current = offer;

        ws.onopen = () => {
          publishToTopic(roomTopic, {
            type: 'room_ready',
            sender: 'host',
            playerName: playerNameRef.current,
            offer,
          });
        };
      } else {
        pc.ondatachannel = (e) => {
          attachDataChannel(e.channel);
        };

        ws.onopen = () => {
          publishToTopic(roomTopic, {
            type: 'guest_joined',
            sender: 'guest',
            playerName: playerNameRef.current,
          });
        };
      }

      const handleIncomingSignal = async (msg: any) => {
        if (!msg || !pcRef.current) return;
        const pcInstance = pcRef.current;

        if (msg.type === 'guest_joined' && isInitiator) {
          setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName, connected: true } : null));
          setMatchStatusText(`Connected to ${msg.playerName}! Starting match.`);
          if (localOfferRef.current) {
            publishToTopic(roomTopic, {
              type: 'offer',
              sender: 'host',
              playerName: playerNameRef.current,
              offer: localOfferRef.current,
            });
          }
        }

        if ((msg.type === 'room_ready' || msg.type === 'offer') && !isInitiator && msg.offer) {
          setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName, connected: true } : null));
          setMatchStatusText(`Connected to ${msg.playerName}! Starting match.`);
          if (pcInstance.signalingState !== 'stable') {
            await pcInstance.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pcInstance.createAnswer();
            await pcInstance.setLocalDescription(answer);
            publishToTopic(roomTopic, {
              type: 'answer',
              sender: 'guest',
              playerName: playerNameRef.current,
              answer,
            });
          }
        }

        if (msg.type === 'answer' && isInitiator && msg.answer) {
          setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName || prev.opponentName, connected: true } : null));
          if (pcInstance.signalingState === 'have-local-offer') {
            await pcInstance.setRemoteDescription(new RTCSessionDescription(msg.answer));
          }
        }

        if (msg.type === 'candidate' && msg.candidate) {
          const expectedSender = isInitiator ? 'guest' : 'host';
          if (msg.sender === expectedSender && pcInstance.remoteDescription) {
            try {
              await pcInstance.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {}
          }
        }

        if (msg.type === 'move') {
          const expectedSender = isInitiator ? 'guest' : 'host';
          if (msg.sender === expectedSender) {
            onRemoteMove(msg.move, msg.state);
          }
        }

        if (msg.type === 'restart') {
          const expectedSender = isInitiator ? 'guest' : 'host';
          if (msg.sender === expectedSender) {
            onRemoteRestart();
          }
        }
      };

      ws.onmessage = async (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.event !== 'message') return;
          const msg = JSON.parse(envelope.message);
          handleIncomingSignal(msg);
        } catch (e) {}
      };
    } catch (err) {
      console.error('PeerConnection setup error:', err);
    }
  };

  /**
   * 4. DATACHANNEL & DELTA SYNCHRONIZATION
   */
  const attachDataChannel = (dc: RTCDataChannel) => {
    dcRef.current = dc;

    dc.onopen = () => {
      setDataChannelOpen(true);
      cancelForfeitCountdown();
      setRoomInfo((prev) => (prev ? { ...prev, connected: true, usingP2P: true } : null));
      setMatchStatusText('Direct P2P WebRTC Connected (<10ms)!');

      // Request delta sync on reconnect
      const currentHistory = currentGameStateRef.current?.moveHistory || [];
      try {
        dc.send(
          JSON.stringify({
            type: 'sync_request',
            lastKnownMoveCount: currentHistory.length,
          })
        );
      } catch (e) {}
    };

    dc.onclose = () => {
      setDataChannelOpen(false);
      startForfeitCountdown();
      setRoomInfo((prev) => (prev ? { ...prev, usingP2P: false } : null));
    };

    dc.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'move') {
          if (payload.state?.moveHistory) {
            lastSeenMoveCountRef.current = payload.state.moveHistory.length;
          }
          onRemoteMove(payload.move, payload.state);
        } else if (payload.type === 'restart') {
          lastSeenMoveCountRef.current = 0;
          onRemoteRestart();
        } else if (payload.type === 'sync_request') {
          // Send missing move if peer made 1 move while offline
          const history = currentGameStateRef.current?.moveHistory || [];
          const peerCount = payload.lastKnownMoveCount || 0;
          if (history.length > peerCount && currentGameStateRef.current) {
            const missingMoves = history.slice(peerCount);
            dc.send(
              JSON.stringify({
                type: 'sync_response',
                missingMoves,
                fullState: currentGameStateRef.current,
              })
            );
          }
        } else if (payload.type === 'sync_response') {
          if (payload.missingMoves && payload.missingMoves.length > 0 && payload.fullState) {
            const lastMove = payload.missingMoves[payload.missingMoves.length - 1];
            onRemoteMove(lastMove, payload.fullState);
          }
        }
      } catch (err) {
        console.error('DataChannel parse error:', err);
      }
    };
  };

  /**
   * 5. BROADCAST MOVE (Direct WebRTC 0-cost with PubSub fallback)
   */
  const sendMove = (move: Move, nextState: GameState) => {
    if (nextState?.moveHistory) {
      lastSeenMoveCountRef.current = nextState.moveHistory.length;
    }

    const payload = {
      type: 'move',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      move,
      state: nextState,
    };

    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify(payload));
      } catch (err) {}
    }

    if (currentRoomIdRef.current) {
      const topic = getCleanTopic(currentRoomIdRef.current);
      publishToTopic(topic, payload);
    }
  };

  /**
   * 6. BROADCAST RESTART
   */
  const sendRestart = () => {
    lastSeenMoveCountRef.current = 0;
    const payload = {
      type: 'restart',
      sender: isInitiatorRef.current ? 'host' : 'guest',
    };

    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify(payload));
      } catch (err) {}
    }

    if (currentRoomIdRef.current) {
      const topic = getCleanTopic(currentRoomIdRef.current);
      publishToTopic(topic, payload);
    }
  };

  return {
    roomInfo,
    isSearching,
    matchStatusText,
    dataChannelOpen,
    isOpponentDisconnected,
    disconnectSecondsLeft,
    startAutoMatch,
    cancelAutoMatch,
    joinCustomRoom,
    sendMove,
    sendRestart,
    cleanupConnection,
  };
}
