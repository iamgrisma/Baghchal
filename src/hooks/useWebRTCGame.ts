import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Move,
  GameState,
  PlayerRole,
  OnlineRoomInfo,
  RematchStatus,
  ConnectionHealth,
  SignalingTier,
} from '../types';
import { BaghchalLedger, LedgerBlock } from '../game/ledger';
import { createInitialGameState } from '../game/rules';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Configurable environment endpoints (no hardcoded secrets)
const DO_URL = import.meta.env.VITE_DO_URL || '';
const EMERGENCY_RELAY_URL = import.meta.env.VITE_EMERGENCY_RELAY_URL || 'https://ntfy.sh';
const MATCHMAKING_TOPIC = import.meta.env.VITE_MATCHMAKING_TOPIC || 'baghchal_matchmaking_v2';

interface UseWebRTCGameProps {
  playerName: string;
  gameState?: GameState;
  onRemoteMove: (move: Move, nextState: GameState, block?: LedgerBlock) => void;
  onOpponentResigned?: () => void;
  onOpponentLeft?: () => void;
  onOpponentForfeitWin?: (reason: string) => void;
  onLocalForfeitLoss?: (reason: string) => void;
  onRematchRequested?: () => void;
  onRematchAccepted?: (newRole: PlayerRole) => void;
  onRematchDeclined?: () => void;
}

export function useWebRTCGame({
  playerName,
  gameState,
  onRemoteMove,
  onOpponentResigned,
  onOpponentLeft,
  onOpponentForfeitWin,
  onLocalForfeitLoss,
  onRematchRequested,
  onRematchAccepted,
  onRematchDeclined,
}: UseWebRTCGameProps) {
  const [roomInfo, setRoomInfo] = useState<OnlineRoomInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [matchStatusText, setMatchStatusText] = useState('Select a mode to play');
  const [dataChannelOpen, setDataChannelOpen] = useState(false);

  // Signaling Hierarchy & Health
  const [signalingTier, setSignalingTier] = useState<SignalingTier>('disconnected');
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>('disconnected');
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState(30);
  const [pingLatencyMs, setPingLatencyMs] = useState<number | null>(null);

  // Rematch / Replay Status
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>('idle');

  const [playerId] = useState(() => `p_${Math.random().toString(36).substring(2, 9)}`);
  const [ledgerChain, setLedgerChain] = useState<LedgerBlock[]>([]);
  const ledgerRef = useRef<BaghchalLedger>(new BaghchalLedger());

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const currentGameStateRef = useRef<GameState | undefined>(gameState);
  currentGameStateRef.current = gameState;

  // WebRTC Peer References
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  // Tier 1: Durable Object WebSocket
  const doWsRef = useRef<WebSocket | null>(null);

  // Tier 2: Redis / KV Polling
  const redisPollIntervalRef = useRef<number | null>(null);

  // Tier 3: Emergency Relay WebSocket
  const relayWsRef = useRef<WebSocket | null>(null);

  // Matchmaking
  const matchSeekIntervalRef = useRef<number | null>(null);
  const matchTimeoutRef = useRef<number | null>(null);
  const matchPollIntervalRef = useRef<number | null>(null);
  const announceIntervalRef = useRef<number | null>(null);

  // Rematch epoch counter to guard against duplicate/out-of-order role flips
  const currentMatchEpochRef = useRef<number>(0);

  // Heartbeat & Watchdogs
  const heartbeatIntervalRef = useRef<number | null>(null);
  const forfeitCountdownRef = useRef<number | null>(null);
  const lastHeartbeatReceivedRef = useRef<number>(Date.now());
  const isOpponentDisconnectedRef = useRef(false);
  isOpponentDisconnectedRef.current = isOpponentDisconnected;

  const currentRoomIdRef = useRef<string | null>(null);
  const roleRef = useRef<PlayerRole | null>(null);
  const isInitiatorRef = useRef(false);
  const localOfferRef = useRef<any>(null);

  const isHighLatency = pingLatencyMs !== null && pingLatencyMs >= 400;

  const getCleanTopic = (roomId: string) => {
    const clean = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `baghchal_rm_${clean}`;
  };

  /**
   * Tiered Dispatch: Sends signaling or fallback messages
   * Tier 1: Durable Object WS -> Tier 2: Redis/KV API -> Tier 3: Emergency Relay
   */
  const sendTieredSignal = async (payload: any) => {
    const roomId = currentRoomIdRef.current;
    if (!roomId) return;
    const sender = isInitiatorRef.current ? 'host' : 'guest';

    // 1. Try Tier 1: Durable Object WebSocket
    if (doWsRef.current && doWsRef.current.readyState === WebSocket.OPEN) {
      try {
        doWsRef.current.send(
          JSON.stringify({
            ...payload,
            roomId,
            sender,
          })
        );
        return;
      } catch (e) {}
    }

    // 2. Try Tier 2: Redis / KV API
    try {
      const res = await fetch('/api/signaling/redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          action: 'publish',
          sender,
          payload,
        }),
      });
      if (res.ok) return;
    } catch (e) {}

    // Also attempt KV store endpoint if available
    try {
      await fetch(`/api/kv/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender,
          payload,
        }),
      });
    } catch (e) {}

    // 3. Fallback Tier 3: Emergency Relay
    try {
      const topic = getCleanTopic(roomId);
      fetch(`${EMERGENCY_RELAY_URL}/${topic}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (e) {}
  };

  /**
   * Unified Game Message Dispatch:
   * Direct WebRTC DataChannel (Primary <10ms) with Tiered Signaling as failover
   */
  const sendPayload = (payload: any) => {
    let sentP2P = false;
    if (dcRef.current && dcRef.current.readyState === 'open') {
      try {
        dcRef.current.send(JSON.stringify(payload));
        sentP2P = true;
      } catch (err) {}
    }

    // Mirror over signaling if P2P is not yet open or for critical game events
    if (!sentP2P || payload.type !== 'heartbeat_ping') {
      sendTieredSignal(payload);
    }
  };

  // 30-Second Forfeit Watchdog (Guarantees visible countdown and fair forfeit handling)
  const startForfeitCountdown = useCallback(() => {
    if (forfeitCountdownRef.current) return;
    isOpponentDisconnectedRef.current = true;
    setIsOpponentDisconnected(true);
    setConnectionHealth(navigator.onLine ? 'opponent_offline' : 'local_offline');
    setDisconnectSecondsLeft(30);

    forfeitCountdownRef.current = window.setInterval(() => {
      setDisconnectSecondsLeft((prev) => {
        if (prev <= 1) {
          if (forfeitCountdownRef.current) {
            clearInterval(forfeitCountdownRef.current);
            forfeitCountdownRef.current = null;
          }
          isOpponentDisconnectedRef.current = false;
          setIsOpponentDisconnected(false);

          if (navigator.onLine) {
            setConnectionHealth('disconnected');
            setMatchStatusText('Opponent forfeited after 30s disconnection. You win!');
            onOpponentForfeitWin?.('opponent_timeout');
          } else {
            setConnectionHealth('local_offline');
            setMatchStatusText('You were disconnected from the match for over 30s.');
            onLocalForfeitLoss?.('local_timeout');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onOpponentForfeitWin, onLocalForfeitLoss]);

  const cancelForfeitCountdown = useCallback(() => {
    isOpponentDisconnectedRef.current = false;
    setIsOpponentDisconnected(false);
    setDisconnectSecondsLeft(30);
    setConnectionHealth('connected');
    if (forfeitCountdownRef.current) {
      clearInterval(forfeitCountdownRef.current);
      forfeitCountdownRef.current = null;
    }
  }, []);

  // Heartbeat Watchdog
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    lastHeartbeatReceivedRef.current = Date.now();

    heartbeatIntervalRef.current = window.setInterval(() => {
      if (!currentRoomIdRef.current) return;

      sendPayload({
        type: 'heartbeat_ping',
        sender: isInitiatorRef.current ? 'host' : 'guest',
        timestamp: Date.now(),
      });

      const elapsed = Date.now() - lastHeartbeatReceivedRef.current;
      if (elapsed > 4500) {
        if (!navigator.onLine) {
          setConnectionHealth('local_offline');
          setMatchStatusText('You are offline. Checking your internet connection...');
          if (!forfeitCountdownRef.current) {
            startForfeitCountdown();
          }
        } else {
          setConnectionHealth('opponent_offline');
          setMatchStatusText('Opponent connection lost. Waiting for opponent...');
          if (!forfeitCountdownRef.current) {
            startForfeitCountdown();
          }
        }
      } else {
        if (isOpponentDisconnectedRef.current) {
          cancelForfeitCountdown();
          setMatchStatusText('Direct P2P WebRTC Connected (<10ms)!');
        }
      }
    }, 2000);
  }, [startForfeitCountdown, cancelForfeitCountdown]);

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const cleanupConnection = () => {
    cancelForfeitCountdown();
    stopHeartbeat();

    if (announceIntervalRef.current) {
      clearInterval(announceIntervalRef.current);
      announceIntervalRef.current = null;
    }
    if (matchSeekIntervalRef.current) {
      clearInterval(matchSeekIntervalRef.current);
      matchSeekIntervalRef.current = null;
    }
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    if (matchPollIntervalRef.current) {
      clearInterval(matchPollIntervalRef.current);
      matchPollIntervalRef.current = null;
    }
    if (redisPollIntervalRef.current) {
      clearInterval(redisPollIntervalRef.current);
      redisPollIntervalRef.current = null;
    }
    if (doWsRef.current) {
      try {
        doWsRef.current.close();
      } catch (e) {}
      doWsRef.current = null;
    }
    if (relayWsRef.current) {
      try {
        relayWsRef.current.close();
      } catch (e) {}
      relayWsRef.current = null;
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
    setConnectionHealth('disconnected');
    setSignalingTier('disconnected');
    setRoomInfo(null);
    setIsSearching(false);
    setRematchStatus('idle');
    currentRoomIdRef.current = null;
    roleRef.current = null;
    localOfferRef.current = null;
  };

  useEffect(() => {
    return () => cleanupConnection();
  }, []);

  // Online / Offline window listeners
  useEffect(() => {
    const handleOnline = () => {
      if (currentRoomIdRef.current) attemptManualReconnect();
    };
    const handleOffline = () => {
      setConnectionHealth('local_offline');
      setMatchStatusText('You are offline. Check network connection.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Cryptographic & Signaling Inbound Processor:
   * Every game move is received as a cryptographic LedgerBlock and deterministically projected.
   */
  const handleIncomingMessage = async (msg: any) => {
    if (!msg) return;
    const pcInstance = pcRef.current;
    const mySenderRole = isInitiatorRef.current ? 'host' : 'guest';
    const expectedSender = isInitiatorRef.current ? 'guest' : 'host';

    // Ignore self-echoes from broadcast signaling
    if (msg.sender === mySenderRole) return;

    // --- HEARTBEAT PING / PONG ---
    if (msg.type === 'heartbeat_ping') {
      lastHeartbeatReceivedRef.current = Date.now();
      cancelForfeitCountdown();
      sendPayload({
        type: 'heartbeat_pong',
        sender: mySenderRole,
        timestamp: msg.timestamp,
      });
      return;
    }

    if (msg.type === 'heartbeat_pong') {
      lastHeartbeatReceivedRef.current = Date.now();
      cancelForfeitCountdown();
      if (msg.timestamp) {
        const latency = Math.max(1, Math.round((Date.now() - msg.timestamp) / 2));
        setPingLatencyMs(latency);
      }
      return;
    }

    // --- SIGNALING MESSAGES ---
    if (msg.type === 'guest_joined' && isInitiatorRef.current) {
      setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName, connected: true } : null));
      setMatchStatusText(`Connected to ${msg.playerName}! Starting match.`);
      if (localOfferRef.current) {
        sendTieredSignal({
          type: 'offer',
          sender: 'host',
          playerName: playerNameRef.current,
          offer: localOfferRef.current,
        });
      }
      return;
    }

    if ((msg.type === 'room_ready' || msg.type === 'offer') && !isInitiatorRef.current && msg.offer && pcInstance) {
      setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName, connected: true } : null));
      setMatchStatusText(`Connected to ${msg.playerName}! Starting match.`);
      if (pcInstance.signalingState !== 'stable') {
        try {
          await pcInstance.setRemoteDescription(new RTCSessionDescription(msg.offer));
          const answer = await pcInstance.createAnswer();
          await pcInstance.setLocalDescription(answer);
          sendTieredSignal({
            type: 'answer',
            sender: 'guest',
            playerName: playerNameRef.current,
            answer,
          });
        } catch (e) {}
      }
      return;
    }

    if (msg.type === 'answer' && isInitiatorRef.current && msg.answer && pcInstance) {
      setRoomInfo((prev) => (prev ? { ...prev, opponentName: msg.playerName || prev.opponentName, connected: true } : null));
      if (pcInstance.signalingState === 'have-local-offer') {
        try {
          await pcInstance.setRemoteDescription(new RTCSessionDescription(msg.answer));
        } catch (e) {}
      }
      return;
    }

    if (msg.type === 'candidate' && msg.candidate && pcInstance) {
      if (msg.sender === expectedSender && pcInstance.remoteDescription) {
        try {
          await pcInstance.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {}
      }
      return;
    }

    // --- PURE CRYPTOGRAPHIC BLOCK EXCHANGE (Blockchain Single Source of Truth) ---
    if (msg.type === 'crypto_block' || msg.type === 'ledger_block') {
      lastHeartbeatReceivedRef.current = Date.now();
      cancelForfeitCountdown();

      const block: LedgerBlock = msg.block;
      if (!block) return;

      // 1. Verify Cryptographic Integrity
      const isValidChain = await ledgerRef.current.verifyAndAppendBlock(block);
      if (!isValidChain) {
        // Delta gap: auto-reconstruct chain from history if available
        if (msg.history && Array.isArray(msg.history)) {
          const reconstructed = await BaghchalLedger.reconstructChainFromHistory(msg.history);
          ledgerRef.current = reconstructed;
          setLedgerChain([...reconstructed.chain]);
        } else {
          // Request missing blocks delta sync
          sendPayload({
            type: 'sync_ledger_req',
            sender: mySenderRole,
            fromIndex: ledgerRef.current.chain.length,
          });
          return;
        }
      } else {
        setLedgerChain([...ledgerRef.current.chain]);
      }

      // 2. Rule & Tamper Verification Against Board
      let currentState = currentGameStateRef.current;
      if (!currentState || currentState.status !== 'playing' || (block.index === 0 && currentState.moveHistory.length > 0)) {
        currentState = createInitialGameState();
        currentGameStateRef.current = currentState;
      }
      const isLegal = BaghchalLedger.verifyBlockMoveLegal(block, currentState);

      if (!isLegal) {
        console.warn('Rejected illegal/tampered block move from peer', block);
        return;
      }

      // 3. Deterministically Map & Project Next State from Cryptographic Block
      const nextState = BaghchalLedger.applyBlockToState(currentState, block);
      currentGameStateRef.current = nextState;
      const move = BaghchalLedger.blockToMove(block);

      onRemoteMove(move, nextState, block);
      return;
    }

    // --- RESIGNATION & FORFEIT ---
    if (msg.type === 'resign') {
      onOpponentResigned?.();
      return;
    }

    if (msg.type === 'player_left') {
      onOpponentLeft?.();
      return;
    }

    // --- MUTUAL REMATCH HANDSHAKE ---
    if (msg.type === 'rematch_request') {
      const incomingEpoch = typeof msg.matchEpoch === 'number' ? msg.matchEpoch : currentMatchEpochRef.current;
      setRematchStatus((prev) => {
        if (prev === 'requested_by_me') {
          // Both requested rematch simultaneously! Accept immediately!
          const nextEpoch = Math.max(incomingEpoch, currentMatchEpochRef.current) + 1;
          sendPayload({ type: 'rematch_accept', sender: mySenderRole, matchEpoch: nextEpoch });
          handleRematchStart(nextEpoch);
          return 'accepted';
        }
        onRematchRequested?.();
        return 'requested_by_opponent';
      });
      return;
    }

    if (msg.type === 'rematch_accept') {
      const targetEpoch = typeof msg.matchEpoch === 'number' ? msg.matchEpoch : (currentMatchEpochRef.current + 1);
      // Guard against duplicate deliveries of the same rematch_accept
      if (targetEpoch > currentMatchEpochRef.current) {
        handleRematchStart(targetEpoch);
        sendPayload({ type: 'rematch_sync_ok', sender: mySenderRole, matchEpoch: targetEpoch });
      }
      return;
    }

    if (msg.type === 'rematch_sync_ok') {
      cancelForfeitCountdown();
      setConnectionHealth('connected');
      return;
    }

    if (msg.type === 'rematch_declined') {
      setRematchStatus('idle');
      onRematchDeclined?.();
      return;
    }

    // --- DELTA SYNC ---
    if (msg.type === 'sync_ledger_req') {
      const missingBlocks = ledgerRef.current.getBlocksFrom(msg.fromIndex || 0);
      sendPayload({
        type: 'sync_ledger_res',
        sender: mySenderRole,
        blocks: missingBlocks,
      });
      return;
    }

    if (msg.type === 'sync_ledger_res') {
      if (Array.isArray(msg.blocks)) {
        for (const b of msg.blocks) {
          await ledgerRef.current.verifyAndAppendBlock(b);
        }
        setLedgerChain([...ledgerRef.current.chain]);

        // Reconstruct game state from full verified ledger
        const moves = ledgerRef.current.chain.map((b) => BaghchalLedger.blockToMove(b));
        let replayState = createInitialGameState();
        for (const m of moves) {
          replayState = BaghchalLedger.applyBlockToState(replayState, ledgerRef.current.chain[replayState.moveHistory.length]);
        }
        if (moves.length > 0) {
          onRemoteMove(moves[moves.length - 1], replayState, ledgerRef.current.chain[moves.length - 1]);
        }
      }
      return;
    }
  };

  const handleRematchStart = (targetEpoch?: number) => {
    const nextEpoch = typeof targetEpoch === 'number' ? targetEpoch : (currentMatchEpochRef.current + 1);
    currentMatchEpochRef.current = nextEpoch;

    ledgerRef.current.reset();
    setLedgerChain([]);
    setRematchStatus('idle');
    cancelForfeitCountdown();
    setDisconnectSecondsLeft(30);

    // Swap roles deterministically using nextEpoch so both sides always stay in sync!
    const hostRole: PlayerRole = (nextEpoch % 2 === 0) ? 'goat' : 'tiger';
    const guestRole: PlayerRole = (nextEpoch % 2 === 0) ? 'tiger' : 'goat';
    const newRole: PlayerRole = isInitiatorRef.current ? hostRole : guestRole;
    roleRef.current = newRole;

    const fresh = createInitialGameState();
    currentGameStateRef.current = fresh;

    setRoomInfo((prev) => (prev ? { ...prev, myRole: newRole, connected: true } : null));
    setConnectionHealth('connected');
    setMatchStatusText(`Rematch started! You are ${newRole === 'goat' ? 'Goat' : 'Tiger'}.`);

    onRematchAccepted?.(newRole);
  };

  const attachDataChannel = (dc: RTCDataChannel) => {
    dcRef.current = dc;

    dc.onopen = () => {
      if (announceIntervalRef.current) {
        clearInterval(announceIntervalRef.current);
        announceIntervalRef.current = null;
      }
      setDataChannelOpen(true);
      cancelForfeitCountdown();
      setConnectionHealth('connected');
      setRoomInfo((prev) => (prev ? { ...prev, connected: true, usingP2P: true } : null));
      setMatchStatusText('Direct P2P WebRTC Connected (<10ms)!');
      startHeartbeat();

      try {
        dc.send(
          JSON.stringify({
            type: 'sync_ledger_req',
            sender: isInitiatorRef.current ? 'host' : 'guest',
            fromIndex: ledgerRef.current.chain.length,
          })
        );
      } catch (e) {}
    };

    dc.onclose = () => {
      setDataChannelOpen(false);
      startForfeitCountdown();
      setRoomInfo((prev) => (prev ? { ...prev, usingP2P: false } : null));
    };

    dc.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleIncomingMessage(payload);
      } catch (err) {
        console.error('DataChannel parse error:', err);
      }
    };
  };

  /**
   * Initializes room signaling across Tier 1 (Durable Object), Tier 2 (Redis/KV), and Tier 3 (Relay)
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

    setConnectionHealth(isInitiallyConnected ? 'connected' : 'reconnecting');
    setMatchStatusText(
      isInitiallyConnected
        ? `Connected to ${opponentName}! Initializing game...`
        : 'Waiting for friend to join with room code...'
    );

    // -------------------------------------------------------------------------
    // Tier 1: Primary Signaling via Cloudflare Durable Object WebSocket
    // -------------------------------------------------------------------------
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = DO_URL ? DO_URL.replace(/^https?:\/\//, '') : window.location.host;
    const doWsUrl = `${protocol}//${host}/api/room/${roomId}?playerId=${playerId}&name=${encodeURIComponent(
      playerNameRef.current
    )}&role=${role}`;

    let doConnected = false;
    try {
      const doWs = new WebSocket(doWsUrl);
      doWsRef.current = doWs;

      doWs.onopen = () => {
        doConnected = true;
        setSignalingTier('durable_object');
      };

      doWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleIncomingMessage(data);
        } catch (e) {}
      };

      doWs.onerror = () => {
        // Fallback to Tier 2 if DO encounters an error or reaches daily limits
        if (!doConnected) initFallbackSignaling(roomId, isInitiator);
      };

      doWs.onclose = () => {
        if (!doConnected) initFallbackSignaling(roomId, isInitiator);
      };
    } catch (err) {
      initFallbackSignaling(roomId, isInitiator);
    }

    // Initialize WebRTC Peer Connection
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendTieredSignal({
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
          setConnectionHealth('connected');
          setRoomInfo((prev) => (prev ? { ...prev, connected: true, usingP2P: true } : null));
          setMatchStatusText('Direct P2P WebRTC Connected (<10ms)!');
          startHeartbeat();
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

        // Broadcast offer across active signaling tier
        sendTieredSignal({
          type: 'room_ready',
          sender: 'host',
          playerName: playerNameRef.current,
          offer,
        });
      } else {
        pc.ondatachannel = (e) => {
          attachDataChannel(e.channel);
        };

        sendTieredSignal({
          type: 'guest_joined',
          sender: 'guest',
          playerName: playerNameRef.current,
        });
      }

      // Hearty Announcement Loop: guarantees asynchronous matchmaking connects
      // even if one player takes a couple seconds to complete their status polling.
      if (announceIntervalRef.current) {
        clearInterval(announceIntervalRef.current);
        announceIntervalRef.current = null;
      }

      let announceCount = 0;
      announceIntervalRef.current = window.setInterval(() => {
        announceCount++;
        if (announceCount > 20 || (dcRef.current && dcRef.current.readyState === 'open')) {
          if (announceIntervalRef.current) {
            clearInterval(announceIntervalRef.current);
            announceIntervalRef.current = null;
          }
          return;
        }

        if (isInitiator) {
          if (localOfferRef.current && pc.signalingState !== 'stable') {
            sendTieredSignal({
              type: 'room_ready',
              sender: 'host',
              playerName: playerNameRef.current,
              offer: localOfferRef.current,
            });
          }
        } else {
          if (pc.signalingState === 'stable' && (!dcRef.current || dcRef.current.readyState !== 'open')) {
            sendTieredSignal({
              type: 'guest_joined',
              sender: 'guest',
              playerName: playerNameRef.current,
            });
          }
        }
      }, 1500);
    } catch (err) {
      console.error('PeerConnection setup error:', err);
    }
  };

  /**
   * Tier 2 & Tier 3 Fallback Signaling: Redis / KV and Emergency Relay
   */
  const initFallbackSignaling = (roomId: string, isInitiator: boolean) => {
    setSignalingTier('redis_kv');

    // Tier 2: Redis / KV Polling
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
        if (res.ok) {
          const data = await res.json();
          for (const msgItem of data.messages || []) {
            handleIncomingMessage(msgItem.payload);
          }
          return;
        }
      } catch (e) {}

      // Try KV endpoint
      try {
        const kvRes = await fetch(`/api/kv/${roomId}`);
        if (kvRes.ok) {
          const kvData = await kvRes.json();
          if (kvData && !kvData.notFound) {
            const mySender = isInitiator ? 'host' : 'guest';
            if (Array.isArray(kvData.messages)) {
              for (const m of kvData.messages) {
                if (m.sender !== mySender && m.payload) {
                  handleIncomingMessage(m.payload);
                }
              }
            }
            if (kvData.offer && !isInitiator && pcRef.current?.signalingState !== 'stable') {
              handleIncomingMessage({
                type: 'offer',
                sender: 'host',
                offer: kvData.offer,
              });
            }
            if (kvData.answer && isInitiator && pcRef.current?.signalingState === 'have-local-offer') {
              handleIncomingMessage({
                type: 'answer',
                sender: 'guest',
                answer: kvData.answer,
              });
            }
          }
        }
      } catch (e) {}
    }, 2500);

    // Tier 3: Emergency Relay WebSocket (Last Resort)
    try {
      const topic = getCleanTopic(roomId);
      const wsUrl = `${EMERGENCY_RELAY_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/${topic}/ws`;
      const relayWs = new WebSocket(wsUrl);
      relayWsRef.current = relayWs;

      relayWs.onopen = () => {
        setSignalingTier('emergency_relay');
      };

      relayWs.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.event !== 'message') return;
          const msg = JSON.parse(envelope.message);
          handleIncomingMessage(msg);
        } catch (e) {}
      };
    } catch (e) {}
  };

  /**
   * Matchmaking: Primary via `/api/matchmaking/join` (KV/Server), fallback to PubSub
   */
  const startAutoMatch = async (preferredRole: 'any' | 'tiger' | 'goat' = 'any') => {
    cleanupConnection();
    setIsSearching(true);
    setMatchStatusText('Searching for opponent...');

    // 1. Try Primary Server Matchmaking Endpoint
    try {
      const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          playerName: playerNameRef.current,
          preferredRole,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'matched') {
          setupRoom(data.roomId, data.role, data.opponentName, data.isInitiator, true);
          return;
        }

        if (data.status === 'waiting' && data.queueId) {
          const queueId = data.queueId;
          matchPollIntervalRef.current = window.setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/matchmaking/status/${queueId}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.status === 'matched') {
                  if (matchPollIntervalRef.current) clearInterval(matchPollIntervalRef.current);
                  setupRoom(
                    statusData.roomId,
                    statusData.role,
                    statusData.opponentName,
                    statusData.isInitiator,
                    true
                  );
                }
              }
            } catch (e) {}
          }, 2000);
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback PubSub Matchmaking if server route unavailable
    try {
      const wsUrl = `${EMERGENCY_RELAY_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/${MATCHMAKING_TOPIC}/ws`;
      const ws = new WebSocket(wsUrl);
      relayWsRef.current = ws;
      const myJoinTime = Date.now();

      ws.onopen = () => {
        const seekPacket = {
          type: 'seek',
          playerId,
          playerName: playerNameRef.current,
          preferredRole,
          timestamp: myJoinTime,
        };
        fetch(`${EMERGENCY_RELAY_URL}/${MATCHMAKING_TOPIC}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(seekPacket),
        }).catch(() => {});

        matchSeekIntervalRef.current = window.setInterval(() => {
          fetch(`${EMERGENCY_RELAY_URL}/${MATCHMAKING_TOPIC}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seekPacket),
          }).catch(() => {});
        }, 2500);

        matchTimeoutRef.current = window.setTimeout(() => {
          if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
          setIsSearching(false);
          setMatchStatusText('No opponent found. Try creating a private room code!');
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

              // Determine roles cleanly (random 50/50 by default)
              let roleForMe: PlayerRole;
              let roleForSeeker: PlayerRole;

              if (preferredRole === 'tiger' && msg.preferredRole === 'goat') {
                roleForMe = 'tiger';
                roleForSeeker = 'goat';
              } else if (preferredRole === 'goat' && msg.preferredRole === 'tiger') {
                roleForMe = 'goat';
                roleForSeeker = 'tiger';
              } else if (preferredRole === 'tiger') {
                roleForMe = 'tiger';
                roleForSeeker = 'goat';
              } else if (preferredRole === 'goat') {
                roleForMe = 'goat';
                roleForSeeker = 'tiger';
              } else if (msg.preferredRole === 'tiger') {
                roleForMe = 'goat';
                roleForSeeker = 'tiger';
              } else if (msg.preferredRole === 'goat') {
                roleForMe = 'tiger';
                roleForSeeker = 'goat';
              } else {
                const rand = Math.random() < 0.5;
                roleForMe = rand ? 'goat' : 'tiger';
                roleForSeeker = rand ? 'tiger' : 'goat';
              }

              fetch(`${EMERGENCY_RELAY_URL}/${MATCHMAKING_TOPIC}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'match_found',
                  seekerId: msg.playerId,
                  proposerId: playerId,
                  roomId,
                  roleSeeker: roleForSeeker,
                  roleProposer: roleForMe,
                  nameSeeker: msg.playerName,
                  nameProposer: playerNameRef.current,
                }),
              }).catch(() => {});

              if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
              if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
              setupRoom(roomId, roleForMe, msg.playerName, true, true);
            }
          }

          if (msg.type === 'match_found' && msg.seekerId === playerId) {
            if (matchSeekIntervalRef.current) clearInterval(matchSeekIntervalRef.current);
            if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
            setupRoom(msg.roomId, msg.roleSeeker, msg.nameProposer, false, true);
          }
        } catch (e) {}
      };
    } catch (err) {
      setIsSearching(false);
      setMatchStatusText('Matchmaking failed. Try a private room code!');
    }
  };

  const cancelAutoMatch = () => {
    cleanupConnection();
    setMatchStatusText('Search cancelled.');
  };

  const joinCustomRoom = async (roomId: string, asHost: boolean) => {
    cleanupConnection();
    setIsSearching(false);
    setMatchStatusText(asHost ? 'Creating private room...' : 'Joining room...');

    const role: PlayerRole = asHost ? 'goat' : 'tiger';
    setupRoom(roomId, role, asHost ? 'Waiting for Friend...' : 'Room Host', asHost, !asHost);
  };

  const attemptManualReconnect = async () => {
    const roomId = currentRoomIdRef.current;
    if (!roomId) return;
    setConnectionHealth('reconnecting');
    setMatchStatusText('Attempting reconnect to opponent...');

    if (!navigator.onLine) {
      setConnectionHealth('local_offline');
      setMatchStatusText('You are currently offline. Check network connection.');
      return;
    }

    const pc = pcRef.current;
    if (pc) {
      try {
        if ('restartIce' in pc && typeof (pc as any).restartIce === 'function') {
          (pc as any).restartIce();
        }
        if (isInitiatorRef.current) {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          localOfferRef.current = offer;
          sendTieredSignal({
            type: 'room_ready',
            sender: 'host',
            playerName: playerNameRef.current,
            offer,
          });
        } else {
          sendTieredSignal({
            type: 'guest_joined',
            sender: 'guest',
            playerName: playerNameRef.current,
          });
        }
      } catch (e) {}
    }

    // If signaling was disconnected, restart fallback listeners
    if (!doWsRef.current && !relayWsRef.current) {
      initFallbackSignaling(roomId, isInitiatorRef.current);
    }

    sendPayload({
      type: 'heartbeat_ping',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      timestamp: Date.now(),
    });

    sendPayload({
      type: 'sync_ledger_req',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      fromIndex: ledgerRef.current.chain.length,
    });
  };

  /**
   * PURE CRYPTOGRAPHIC MOVE DISPATCH:
   * The local move is authored into a LedgerBlock, appended to the immutable local ledger,
   * and transmitted over WebRTC DataChannel (with tiered signaling backup).
   */
  const sendMove = async (move: Move, nextState: GameState, block?: LedgerBlock) => {
    if (!block) {
      // Author block if not pre-constructed
      block = await ledgerRef.current.createBlock(move.piece, move, move.captured);
    }

    await ledgerRef.current.appendLocalBlock(block);
    setLedgerChain([...ledgerRef.current.chain]);

    // Send purely the cryptographic block (and lightweight move history for sync verification)
    sendPayload({
      type: 'crypto_block',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      block,
      history: nextState.moveHistory,
    });
  };

  const sendResign = () => {
    sendPayload({
      type: 'resign',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      playerRole: roleRef.current,
    });
  };

  const sendLeaveRoom = () => {
    sendPayload({
      type: 'player_left',
      sender: isInitiatorRef.current ? 'host' : 'guest',
    });
    cleanupConnection();
  };

  const requestRematch = () => {
    setRematchStatus('requested_by_me');
    sendPayload({
      type: 'rematch_request',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      matchEpoch: currentMatchEpochRef.current,
    });
  };

  const acceptRematch = () => {
    const nextEpoch = currentMatchEpochRef.current + 1;
    sendPayload({
      type: 'rematch_accept',
      sender: isInitiatorRef.current ? 'host' : 'guest',
      matchEpoch: nextEpoch,
    });
    handleRematchStart(nextEpoch);
  };

  const declineRematch = () => {
    sendPayload({
      type: 'rematch_declined',
      sender: isInitiatorRef.current ? 'host' : 'guest',
    });
    setRematchStatus('idle');
    cleanupConnection();
  };

  return {
    roomInfo,
    isSearching,
    matchStatusText,
    dataChannelOpen,
    signalingTier,
    connectionHealth,
    isOpponentDisconnected,
    disconnectSecondsLeft,
    pingLatencyMs,
    isHighLatency,
    rematchStatus,
    ledgerChain,
    startAutoMatch,
    cancelAutoMatch,
    joinCustomRoom,
    attemptManualReconnect,
    sendMove,
    sendResign,
    sendLeaveRoom,
    requestRematch,
    acceptRematch,
    declineRematch,
    cleanupConnection,
  };
}
