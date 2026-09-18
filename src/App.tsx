import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AIDifficulty,
  GameMode,
  GameState,
  Move,
  PieceType,
  PlayerProfile,
  PlayerRole,
} from './types';
import {
  applyMove,
  createInitialGameState,
  getAllGoatMoves,
  getAllTigerMoves,
  getTigerMovesForPos,
  getTrappedTigersInfo,
} from './game/rules';
import { getAIMove, getAdaptiveAIDetails } from './game/ai';
import { sound } from './utils/audio';
import { loadPlayerProfile, recordMatchResult, savePlayerProfile } from './utils/storage';
import { useWebRTCGame } from './hooks/useWebRTCGame';
import { BaghchalBoard } from './components/BaghchalBoard';
import { MinimalGameHUD } from './components/MinimalGameHUD';
import { SplashScreen } from './components/SplashScreen';
import { GameSetupScreen } from './components/GameSetupScreen';
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  RefreshCw,
  HelpCircle,
  Trophy,
  Globe,
  LogOut,
} from 'lucide-react';
import {
  initTelegramWebApp,
  isTelegramWebApp,
  getTelegramUser,
  getTelegramStartParam,
  triggerTelegramHaptic,
} from './utils/telegram';

type AppScreen = 'splash' | 'setup' | 'play';

export default function App() {
  // Navigation Screens: 'play' is default for immediate Telegram gameplay
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('play');

  // Game State
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [historyStack, setHistoryStack] = useState<GameState[]>([]);
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [aiUserRole, setAiUserRole] = useState<PlayerRole>('goat');

  // Interaction State
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());

  // Player Profile
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);

  // Modals
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  // Timer reference for match duration
  const matchStartTime = useRef(Date.now());
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // WebRTC Game Hook
  const {
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
  } = useWebRTCGame({
    playerName: profile.name,
    onRemoteMove: (remoteMove, nextState) => {
      // Play sound and haptics according to remote move
      if (remoteMove.type === 'jump') {
        sound.playAttack();
        triggerTelegramHaptic('heavy');
      } else if (remoteMove.type === 'place') {
        sound.playPlace('goat');
        triggerTelegramHaptic('light');
      } else {
        sound.playMove(remoteMove.piece);
        triggerTelegramHaptic('medium');
      }

      setGameState(nextState);
      setSelectedPos(null);
    },
    onRemoteRestart: () => {
      resetGame();
    },
    onOpponentDisconnected: () => {
      alert('Your online opponent disconnected.');
    },
  });

  // Telegram Mini App Initialization & deep link detection
  useEffect(() => {
    initTelegramWebApp();
    const inTg = isTelegramWebApp();
    setIsTelegram(inTg);

    if (inTg) {
      const tgUser = getTelegramUser();
      if (tgUser && (profile.name === 'Baghchal Champion' || !profile.name)) {
        const updated = { ...profile, name: tgUser.name };
        setProfile(updated);
        savePlayerProfile(updated);
      }
    }

    // Auto-join custom room if opened via Telegram deep-link
    const deepRoom = getTelegramStartParam();
    if (deepRoom) {
      setMode('online');
      resetGame();
      joinCustomRoom(deepRoom, false);
      setCurrentScreen('play');
    }
  }, []);

  // Online connection transition: automatically close lobby modal and play start chime when opponent joins
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (roomInfo?.connected && !prevConnectedRef.current) {
      try {
        if (typeof sound.playGameStart === 'function') {
          sound.playGameStart();
        } else {
          sound.playMove();
        }
      } catch (e) {
        console.warn('Connect sound error:', e);
      }
      try {
        triggerTelegramHaptic('success');
      } catch (e) {}
      setShowOnlineLobby(false);
    }
    prevConnectedRef.current = !!roomInfo?.connected;
  }, [roomInfo?.connected]);

  // Online matchmaking / room handlers
  const handleStartAutoMatch = (role: 'any' | 'tiger' | 'goat') => {
    setMode('online');
    resetGame();
    startAutoMatch(role);
  };

  const handleJoinCustomRoom = (roomId: string, asHost: boolean) => {
    setMode('online');
    resetGame();
    joinCustomRoom(roomId, asHost);
  };

  const handleCancelAutoMatch = () => {
    cancelAutoMatch();
    setMode('ai');
  };

  const handleLeaveOnlineRoom = () => {
    cleanupConnection();
    setMode('ai');
    resetGame();
    setShowOnlineLobby(false);
  };

  // Determine roles for display and interaction
  const userRole: PlayerRole =
    mode === 'online' && roomInfo?.myRole
      ? roomInfo.myRole
      : mode === 'ai'
      ? aiUserRole
      : 'goat';
  const opponentRole: PlayerRole = userRole === 'goat' ? 'tiger' : 'goat';

  // Calculate current trapped tigers
  const trappedInfo = getTrappedTigersInfo(gameState.board);

  // Determine if human user is allowed to make a move right now
  const isUserTurn = useCallback(() => {
    if (gameState.status !== 'playing') return false;
    if (mode === 'local') return true;
    if (mode === 'ai') {
      if (isAiThinking) return false;
      return gameState.turn === aiUserRole;
    }
    if (mode === 'online') {
      if (!roomInfo || !roomInfo.connected) return false;
      return gameState.turn === roomInfo.myRole;
    }
    return false;
  }, [gameState.status, gameState.turn, mode, isAiThinking, aiUserRole, roomInfo]);

  // Compute valid moves for currently selected node or placement
  const currentValidMoves = useCallback((): Move[] => {
    if (!isUserTurn()) return [];

    // Placement phase for Goats
    if (gameState.turn === 'goat' && gameState.phase === 'placement') {
      return getAllGoatMoves(gameState.board, gameState.goatsInReserve);
    }

    // Otherwise, must have a piece selected to move
    if (selectedPos === null) return [];

    const piece = gameState.board[selectedPos];
    if (piece !== gameState.turn) return [];

    if (piece === 'tiger') {
      return getTigerMovesForPos(gameState.board, selectedPos);
    }

    if (piece === 'goat' && gameState.phase === 'movement') {
      const allMoves = getAllGoatMoves(gameState.board, 0);
      return allMoves.filter((m) => m.from === selectedPos);
    }

    return [];
  }, [isUserTurn, gameState, selectedPos]);

  const validMoves = currentValidMoves();

  // Reset Game
  const resetGame = useCallback(() => {
    const fresh = createInitialGameState();
    setGameState(fresh);
    setHistoryStack([]);
    setSelectedPos(null);
    setIsAiThinking(false);
    setShowGameOverModal(false);
    matchStartTime.current = Date.now();
  }, []);

  // Handle game over logic (sound, stats, modal)
  useEffect(() => {
    if (gameState.status !== 'playing') {
      setShowGameOverModal(true);

      const isTigerWon = gameState.status === 'tiger_won';
      const isGoatWon = gameState.status === 'goat_won';

      if (isGoatWon) {
        sound.playGoatMarchVictory();
      } else if (isTigerWon) {
        sound.playTigerVictory();
      }

      let userWon = false;
      if (mode === 'ai') {
        userWon = isTigerWon ? aiUserRole === 'tiger' : aiUserRole === 'goat';
      } else if (mode === 'online' && roomInfo) {
        userWon = isTigerWon ? roomInfo.myRole === 'tiger' : roomInfo.myRole === 'goat';
      } else {
        // Local 2-player
        userWon = true;
      }

      if (userWon) {
        triggerTelegramHaptic('success');
      } else {
        triggerTelegramHaptic('error');
      }

      // Record profile statistics
      const durationSeconds = Math.max(1, Math.round((Date.now() - matchStartTime.current) / 1000));
      const rolePlayed = mode === 'online' && roomInfo ? roomInfo.myRole : aiUserRole;
      const adaptiveDetails = getAdaptiveAIDetails(profile);
      const opponentName =
        mode === 'ai'
          ? difficulty === 'adaptive'
            ? `AI (Adaptive: ${adaptiveDetails.effectiveDifficulty})`
            : `AI (${difficulty})`
          : mode === 'online' && roomInfo
          ? roomInfo.opponentName
          : 'Local Friend';

      const updated = recordMatchResult({
        mode,
        userRole: rolePlayed,
        opponent: opponentName,
        result: userWon ? 'won' : 'lost',
        goatsCaptured: gameState.goatsCaptured,
        totalTurns: gameState.moveHistory.length,
        durationSeconds,
      });
      setProfile(updated);
    }
  }, [gameState.status]);

  // AI Turn Handler
  useEffect(() => {
    if (
      mode !== 'ai' ||
      gameState.status !== 'playing' ||
      gameState.turn === aiUserRole
    ) {
      setIsAiThinking(false);
      return;
    }

    setIsAiThinking(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const currentState = gameStateRef.current;
        if (
          cancelled ||
          currentState.status !== 'playing' ||
          currentState.turn === aiUserRole
        ) {
          return;
        }

        const aiRole: PlayerRole = aiUserRole === 'goat' ? 'tiger' : 'goat';
        const bestMove = await getAIMove(currentState, aiRole, difficulty, profile);

        if (!cancelled && bestMove) {
          executeMove(bestMove);
        }
      } catch (err) {
        console.error('Error calculating AI move:', err);
      } finally {
        if (!cancelled) {
          setIsAiThinking(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, gameState.turn, gameState.status, aiUserRole, difficulty, profile]);

  // Execute a verified Move
  const executeMove = (move: Move) => {
    const currentState = gameStateRef.current;

    // Sound effect and Telegram Haptic Feedback
    if (move.type === 'jump') {
      sound.playAttack(); // Royal Bengal Tiger Roar on capture!
      triggerTelegramHaptic('heavy');
    } else if (move.type === 'place') {
      sound.playPlace('goat'); // Goat "myaa" sound on placement!
      triggerTelegramHaptic('light');
    } else {
      sound.playMove(move.piece); // Goat "myaa" or tiger stealth slide tap!
      triggerTelegramHaptic('medium');
    }

    setHistoryStack((prev) => [...prev, currentState]);
    const nextState = applyMove(currentState, move);

    // Check if tiger became trapped for sound & haptic
    const beforeTrapped = getTrappedTigersInfo(currentState.board).trappedCount;
    const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
    if (afterTrapped > beforeTrapped) {
      sound.playTrap();
      triggerTelegramHaptic('warning');
    }

    setGameState(nextState);
    setSelectedPos(null);

    // If online, broadcast to remote peer via WebRTC / Cloudflare Edge
    if (mode === 'online') {
      sendMove(move, nextState);
    }
  };

  // Node Click Interaction
  const handleNodeClick = (pos: number) => {
    if (!isUserTurn()) return;

    const pieceAtNode = gameState.board[pos];

    // 1. Placement phase for Goats: tap any empty node to place
    if (
      gameState.turn === 'goat' &&
      gameState.phase === 'placement' &&
      pieceAtNode === null
    ) {
      executeMove({
        type: 'place',
        to: pos,
        piece: 'goat',
      });
      return;
    }

    // 2. Target destination clicked: execute move
    const matchedMove = validMoves.find((m) => m.to === pos);
    if (matchedMove) {
      executeMove(matchedMove);
      return;
    }

    // 3. Selection of piece to move
    if (pieceAtNode === gameState.turn) {
      setSelectedPos(selectedPos === pos ? null : pos);
      triggerTelegramHaptic('selection');
      return;
    }

    // 4. Clicked outside valid options
    setSelectedPos(null);
  };

  // Undo Move (Local or AI mode)
  const handleUndo = () => {
    if (historyStack.length === 0 || mode === 'online' || isAiThinking) return;

    if (mode === 'ai') {
      // Undo both the AI's move and the user's move (2 steps)
      if (historyStack.length >= 2) {
        const targetState = historyStack[historyStack.length - 2];
        setHistoryStack((prev) => prev.slice(0, prev.length - 2));
        setGameState(targetState);
      } else {
        const targetState = historyStack[0];
        setHistoryStack([]);
        setGameState(targetState);
      }
    } else {
      // Local 2-player: undo 1 step
      const targetState = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, prev.length - 1));
      setGameState(targetState);
    }

    setIsAiThinking(false);
    setSelectedPos(null);
    setShowGameOverModal(false);
    sound.playMove();
  };

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  // Render Screen 1: Splash Screen
  if (currentScreen === 'splash') {
    return (
      <>
        <SplashScreen
          onStartClick={() => setCurrentScreen('setup')}
          onOpenRules={() => setShowRules(true)}
          onOpenProfile={() => setShowProfile(true)}
          isTelegram={isTelegram}
        />
        <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
        <ProfileModal
          isOpen={showProfile}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onUpdateName={(name) => {
            const updated = { ...profile, name };
            savePlayerProfile(updated);
            setProfile(updated);
          }}
          onResetStats={() => {
            const fresh = {
              ...profile,
              gamesPlayed: 0,
              winsGoat: 0,
              winsTiger: 0,
              losses: 0,
              currentStreak: 0,
              bestStreak: 0,
              history: [],
            };
            savePlayerProfile(fresh);
            setProfile(fresh);
          }}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Render Screen 2: Game Setup Screen
  if (currentScreen === 'setup') {
    return (
      <>
        <GameSetupScreen
          mode={mode}
          aiUserRole={aiUserRole}
          difficulty={difficulty}
          profile={profile}
          onSelectMode={(newMode) => {
            if (mode === 'online' && newMode !== 'online') {
              cleanupConnection();
            }
            setMode(newMode);
            resetGame();
          }}
          onSelectAIRole={(r) => {
            setAiUserRole(r);
            resetGame();
          }}
          onSelectDifficulty={(d) => setDifficulty(d)}
          onStartGame={() => {
            resetGame();
            if (mode === 'online') {
              setShowOnlineLobby(true);
            }
            setCurrentScreen('play');
          }}
          onBackToSplash={() => setCurrentScreen('splash')}
          onOpenRules={() => setShowRules(true)}
        />
        <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
        <ProfileModal
          isOpen={showProfile}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onUpdateName={(name) => {
            const updated = { ...profile, name };
            savePlayerProfile(updated);
            setProfile(updated);
          }}
          onResetStats={() => {
            const fresh = {
              ...profile,
              gamesPlayed: 0,
              winsGoat: 0,
              winsTiger: 0,
              losses: 0,
              currentStreak: 0,
              bestStreak: 0,
              history: [],
            };
            savePlayerProfile(fresh);
            setProfile(fresh);
          }}
        />
        <OnlineLobbyModal
          isOpen={showOnlineLobby}
          playerName={profile.name}
          isSearching={isSearching}
          matchStatusText={matchStatusText}
          roomInfo={roomInfo}
          onClose={() => setShowOnlineLobby(false)}
          onStartAutoMatch={handleStartAutoMatch}
          onCancelAutoMatch={handleCancelAutoMatch}
          onJoinCustomRoom={handleJoinCustomRoom}
          onLeaveRoom={handleLeaveOnlineRoom}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Render Screen: Immersive Single-Viewport Mobile Game UI
  return (
    <main
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col justify-between overflow-hidden select-none touch-none px-2 py-1 xs:py-1.5"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* 1. TOP GAME HUD: Opponent Status & Quick Controls */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between gap-1.5 px-1 py-1 shrink-0">
        {/* Opponent Player Badge */}
        <div className="flex items-center gap-1.5 bg-stone-900/90 border border-stone-800/90 rounded-xl px-2.5 py-1 shadow-sm">
          <div className="text-base relative">
            {opponentRole === 'tiger' ? '🐅' : '🐐'}
            {gameState.turn === opponentRole && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-stone-200 leading-tight">
              {mode === 'ai'
                ? `AI (${difficulty === 'adaptive' ? getAdaptiveAIDetails(profile).tierLabel : difficulty})`
                : mode === 'online' && roomInfo
                ? roomInfo.opponentName
                : opponentRole === 'tiger'
                ? 'Tiger Player'
                : 'Goat Player'}
            </span>
            {opponentRole === 'tiger' ? (
              <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium">
                <span>Trapped:</span>
                <strong className="font-mono text-stone-100">{trappedInfo.trappedCount}/4</strong>
                <div className="flex items-center gap-0.5 ml-0.5">
                  {[0, 1, 2, 3].map((slot) => (
                    <span
                      key={`opp-trap-pip-${slot}`}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        slot < trappedInfo.trappedCount
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 ring-1 ring-emerald-300'
                          : 'bg-stone-800 border border-stone-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[9px] text-stone-400 font-medium">
                <span>Reserve: <strong className="font-mono text-amber-300">{gameState.goatsInReserve}</strong></span>
                <span>Eaten: <strong className="font-mono text-red-400">{gameState.goatsCaptured}/5</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Turn Status Pill */}
        <div className="flex items-center">
          {gameState.status !== 'playing' ? (
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-stone-950 shadow">
              {gameState.status === 'goat_won' ? 'Goats Won! 🏆' : 'Tigers Won! 🏆'}
            </span>
          ) : mode === 'online' && roomInfo && !roomInfo.connected ? (
            <button
              onClick={() => setShowOnlineLobby(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Waiting for Opponent</span>
            </button>
          ) : isAiThinking ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Thinking...</span>
            </span>
          ) : isUserTurn() ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500 text-stone-950 ring-2 ring-emerald-400/50 shadow-sm">
              <span>{userRole === 'goat' ? '🐐 Your Turn' : '🐅 Your Turn'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-900 text-stone-300 border border-stone-800 shadow-sm">
              <span>{opponentRole === 'goat' ? '🐐' : '🐅'} {mode === 'online' && roomInfo ? roomInfo.opponentName : 'Opponent'}'s Turn</span>
            </span>
          )}
        </div>

        {/* Right: Quick Action Icons & Online Room Badge */}
        <div className="flex items-center gap-1">
          {mode === 'online' && roomInfo && (
            <button
              onClick={() => setShowOnlineLobby(true)}
              className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-[10px] font-mono font-bold text-amber-300 border border-stone-800 flex items-center gap-1 transition"
              title="View room code / invite link"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  roomInfo.connected
                    ? roomInfo.usingP2P
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-sky-400'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span>{roomInfo.roomId.replace('bc_', '').toUpperCase()}</span>
            </button>
          )}
          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs transition active:scale-95"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs transition active:scale-95"
            title="How to play"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowProfile(true)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs transition active:scale-95"
            title="Profile & Stats"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </header>

      {/* 2. CENTER SQUARE BOARD ARENA */}
      <section className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-0.5 sm:p-1">
        <div className="w-[min(94vw,calc(100dvh-175px))] h-[min(94vw,calc(100dvh-175px))] max-w-[460px] max-h-[460px] aspect-square flex items-center justify-center">
          <BaghchalBoard
            board={gameState.board}
            turn={gameState.turn}
            phase={gameState.phase}
            goatsInReserve={gameState.goatsInReserve}
            selectedPos={selectedPos}
            validMoves={validMoves}
            lastMove={gameState.lastMove}
            isInteractive={isUserTurn()}
            onNodeClick={handleNodeClick}
          />
        </div>
      </section>

      {/* 3. TACTICAL STATUS RIBBON */}
      <div className="w-full max-w-lg mx-auto text-center shrink-0 py-0.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-900/90 border border-stone-800/80 text-[11px] font-medium text-amber-300 shadow-sm">
          {gameState.status !== 'playing' ? (
            <span>Match finished! Tap "Play Again" or "Reset".</span>
          ) : mode === 'online' && roomInfo && !roomInfo.connected ? (
            <span>
              Room Code: <strong className="text-amber-200">{roomInfo.roomId.replace('bc_', '').toUpperCase()}</strong> • Share code with a friend to play!
            </span>
          ) : mode === 'online' && !isUserTurn() ? (
            <span>Waiting for {roomInfo?.opponentName || 'opponent'} to move...</span>
          ) : isAiThinking ? (
            <span>Tiger is calculating optimal tactical move...</span>
          ) : userRole === 'goat' ? (
            gameState.phase === 'placement' ? (
              <span>Tap empty spot to place Goat ({gameState.goatsInReserve} in reserve)</span>
            ) : selectedPos === null ? (
              <span>Select a Goat to move</span>
            ) : (
              <span>Tap adjacent empty spot to move</span>
            )
          ) : selectedPos === null ? (
            <span>Select a Tiger to move or jump capture</span>
          ) : (
            <span>Tap adjacent spot or jump over a goat</span>
          )}
        </div>
      </div>

      {/* 4. BOTTOM PLAYER STATS & ACTION CONTROLS */}
      <footer className="w-full max-w-lg mx-auto flex flex-col gap-1.5 shrink-0 px-1 pb-1">
        {/* User Player Row */}
        <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800/80 rounded-xl px-2.5 py-1 text-xs shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{userRole === 'goat' ? '🐐' : '🐅'}</span>
            <span className="font-bold text-stone-200">
              {profile.name || 'You'} {userRole === 'goat' ? '(Goats)' : '(Tigers)'}
            </span>
          </div>
          {userRole === 'goat' ? (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-stone-300">
                Reserve: <strong className="font-mono text-amber-300">{gameState.goatsInReserve}</strong>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-stone-300">Eaten:</span>
                <strong className="font-mono text-red-400 mr-1">{gameState.goatsCaptured}/5</strong>
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((slot) => (
                    <span
                      key={`user-eaten-pip-${slot}`}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        slot < gameState.goatsCaptured
                          ? 'bg-red-500 shadow-sm shadow-red-500/80 ring-1 ring-red-400'
                          : 'bg-stone-800 border border-stone-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-stone-300">Trapped:</span>
              <strong className="font-mono text-amber-400">{trappedInfo.trappedCount}/4</strong>
              <div className="flex items-center gap-0.5 ml-0.5">
                {[0, 1, 2, 3].map((slot) => (
                  <span
                    key={`user-trap-pip-${slot}`}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      slot < trappedInfo.trappedCount
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 ring-1 ring-emerald-300'
                        : 'bg-stone-800 border border-stone-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Button Deck: Large thumb-friendly arcade buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {/* Button 1: Undo or Leave (in online mode) */}
          {mode === 'online' ? (
            <button
              onClick={handleLeaveOnlineRoom}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 text-xs font-bold transition active:scale-95 shadow"
              title="Leave online room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          ) : (
            <button
              onClick={handleUndo}
              disabled={historyStack.length === 0 || isAiThinking}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition ${
                historyStack.length === 0 || isAiThinking
                  ? 'bg-stone-900/40 text-stone-600 border border-stone-900 cursor-not-allowed'
                  : 'bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 active:scale-95 shadow'
              }`}
              title="Undo last move"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          {/* Button 2: Restart / Reset */}
          <button
            onClick={() => {
              resetGame();
              if (mode === 'online') sendRestart();
            }}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-bold transition active:scale-95 shadow"
            title="Restart match"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Button 3: Mode / Setup */}
          <button
            onClick={() => setShowSetupModal(true)}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-black transition active:scale-95 shadow"
            title="Change Game Mode or Difficulty"
          >
            <span>🎮 Mode</span>
          </button>

          {/* Button 4: Online Lobby */}
          <button
            onClick={() => setShowOnlineLobby(true)}
            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition active:scale-95 shadow ${
              mode === 'online'
                ? roomInfo?.connected
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
            title="Online Multiplayer with Friends"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{mode === 'online' ? (roomInfo?.connected ? 'Room' : 'Invite') : 'Online'}</span>
          </button>
        </div>
      </footer>

      {/* Modals & Overlays */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-stone-800 bg-stone-950 p-4 shadow-2xl">
            <GameSetupScreen
              mode={mode}
              aiUserRole={aiUserRole}
              difficulty={difficulty}
              profile={profile}
              onSelectMode={(newMode) => {
                if (mode === 'online' && newMode !== 'online') {
                  cleanupConnection();
                }
                setMode(newMode);
                resetGame();
              }}
              onSelectAIRole={(r) => {
                setAiUserRole(r);
                resetGame();
              }}
              onSelectDifficulty={(d) => setDifficulty(d)}
              onStartGame={() => {
                resetGame();
                if (mode === 'online') {
                  setShowOnlineLobby(true);
                }
                setShowSetupModal(false);
              }}
              onBackToSplash={() => setShowSetupModal(false)}
              onOpenRules={() => {
                setShowSetupModal(false);
                setShowRules(true);
              }}
            />
          </div>
        </div>
      )}

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      <ProfileModal
        isOpen={showProfile}
        profile={profile}
        onClose={() => setShowProfile(false)}
        onUpdateName={(name) => {
          const updated = { ...profile, name };
          savePlayerProfile(updated);
          setProfile(updated);
        }}
        onResetStats={() => {
          const fresh = {
            ...profile,
            gamesPlayed: 0,
            winsGoat: 0,
            winsTiger: 0,
            losses: 0,
            currentStreak: 0,
            bestStreak: 0,
            history: [],
          };
          savePlayerProfile(fresh);
          setProfile(fresh);
        }}
      />

      <OnlineLobbyModal
        isOpen={showOnlineLobby}
        playerName={profile.name}
        isSearching={isSearching}
        matchStatusText={matchStatusText}
        roomInfo={roomInfo}
        onClose={() => setShowOnlineLobby(false)}
        onStartAutoMatch={handleStartAutoMatch}
        onCancelAutoMatch={handleCancelAutoMatch}
        onJoinCustomRoom={handleJoinCustomRoom}
        onLeaveRoom={handleLeaveOnlineRoom}
      />

      <GameOverModal
        isOpen={showGameOverModal}
        status={gameState.status}
        goatsCaptured={gameState.goatsCaptured}
        totalTurns={gameState.moveHistory.length}
        userRole={mode === 'online' && roomInfo ? roomInfo.myRole : mode === 'ai' ? aiUserRole : undefined}
        onPlayAgain={() => {
          resetGame();
          if (mode === 'online') sendRestart();
        }}
        onChangeMode={() => {
          resetGame();
          setShowGameOverModal(false);
          setShowSetupModal(true);
        }}
        onReviewBoard={() => setShowGameOverModal(false)}
      />

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />
    </main>
  );
}
