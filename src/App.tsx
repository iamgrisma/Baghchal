import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AIDifficulty,
  BoardTheme,
  GameMode,
  GameState,
  Move,
  PlayerProfile,
  PlayerRole,
  TimerMode,
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
import { triggerNativeHaptic } from './utils/nativeHaptics';
import { useMobileLifecycle } from './hooks/useMobileLifecycle';
import { useWebRTCGame } from './hooks/useWebRTCGame';
import { TigerIcon, GoatIcon } from './components/GameIcons';
import { BaghchalBoard } from './components/BaghchalBoard';
import { SplashScreen } from './components/SplashScreen';
import { GameSetupScreen } from './components/GameSetupScreen';
import { SideDrawer } from './components/SideDrawer';
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  Menu,
  Clock,
  RotateCcw,
} from 'lucide-react';
import {
  initTelegramWebApp,
  isTelegramWebApp,
  getTelegramStartParam,
  triggerTelegramHaptic,
} from './utils/telegram';

type AppScreen = 'splash' | 'setup' | 'play';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');

  // Game State
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [historyStack, setHistoryStack] = useState<GameState[]>([]);
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [aiUserRole, setAiUserRole] = useState<PlayerRole>('goat');

  // Board Theme & Timer Modes
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('classic');
  const [timerMode, setTimerMode] = useState<TimerMode>('unlimited');
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(30);
  const [blitzClocks, setBlitzClocks] = useState<{ goat: number; tiger: number }>({
    goat: 300,
    tiger: 300,
  });

  // Interaction State
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());

  // Player Profile
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);

  // Modals & Side Flyout Menu
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
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
      if (remoteMove.type === 'jump') {
        sound.playAttack();
        triggerTelegramHaptic('heavy');
        triggerNativeHaptic('heavy');
      } else if (remoteMove.type === 'place') {
        sound.playPlace('goat');
        triggerTelegramHaptic('light');
        triggerNativeHaptic('light');
      } else {
        sound.playMove(remoteMove.piece);
        triggerTelegramHaptic('medium');
        triggerNativeHaptic('medium');
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

  // Native Android Hardware Lifecycle Hook
  useMobileLifecycle({
    currentScreen,
    onNavigateBack: () => {
      if (showSideMenu) {
        setShowSideMenu(false);
      } else if (currentScreen === 'play') {
        if (mode === 'online') {
          handleLeaveOnlineRoom();
        }
        setCurrentScreen('setup');
      } else if (currentScreen === 'setup') {
        setCurrentScreen('splash');
      }
    },
  });

  // Telegram WebApp Initialization
  useEffect(() => {
    initTelegramWebApp();
    setIsTelegram(isTelegramWebApp());

    const deepRoom = getTelegramStartParam();
    if (deepRoom) {
      setMode('online');
      resetGame();
      joinCustomRoom(deepRoom, false);
      setCurrentScreen('play');
    }
  }, []);

  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (roomInfo?.connected && !prevConnectedRef.current) {
      try {
        if (typeof sound.playGameStart === 'function') {
          sound.playGameStart();
        } else {
          sound.playMove();
        }
      } catch (e) {}
      try {
        triggerTelegramHaptic('success');
        triggerNativeHaptic('success');
      } catch (e) {}
      setShowOnlineLobby(false);
    }
    prevConnectedRef.current = !!roomInfo?.connected;
  }, [roomInfo?.connected]);

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

  const userRole: PlayerRole =
    mode === 'online' && roomInfo?.myRole
      ? roomInfo.myRole
      : mode === 'ai'
      ? aiUserRole
      : 'goat';
  const opponentRole: PlayerRole = userRole === 'goat' ? 'tiger' : 'goat';

  const trappedInfo = getTrappedTigersInfo(gameState.board);

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

  const currentValidMoves = useCallback((): Move[] => {
    if (!isUserTurn()) return [];

    if (gameState.turn === 'goat' && gameState.phase === 'placement') {
      return getAllGoatMoves(gameState.board, gameState.goatsInReserve);
    }

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

  const resetGame = useCallback(() => {
    const fresh = createInitialGameState();
    setGameState(fresh);
    setHistoryStack([]);
    setSelectedPos(null);
    setIsAiThinking(false);
    setShowGameOverModal(false);
    matchStartTime.current = Date.now();
    setTurnSecondsLeft(30);
    setBlitzClocks({ goat: 300, tiger: 300 });
  }, []);

  // Clock Countdown Loop
  useEffect(() => {
    if (gameState.status !== 'playing' || currentScreen !== 'play') return;
    if (timerMode === 'unlimited') return;

    const interval = window.setInterval(() => {
      if (timerMode === 'turn30s') {
        setTurnSecondsLeft((prev) => {
          if (prev <= 1) {
            if (isUserTurn()) {
              triggerTelegramHaptic('warning');
              triggerNativeHaptic('warning');
            }
            return 30;
          }
          return prev - 1;
        });
      } else if (timerMode === 'blitz5m') {
        setBlitzClocks((prev) => {
          const currentTurn = gameStateRef.current.turn;
          const nextTime = Math.max(0, prev[currentTurn] - 1);

          if (nextTime === 0) {
            const winningStatus = currentTurn === 'goat' ? 'tiger_won' : 'goat_won';
            setGameState((s) => ({ ...s, status: winningStatus }));
          }

          return {
            ...prev,
            [currentTurn]: nextTime,
          };
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, currentScreen, timerMode, isUserTurn]);

  useEffect(() => {
    if (timerMode === 'turn30s') {
      setTurnSecondsLeft(30);
    }
  }, [gameState.turn, gameState.moveHistory.length, timerMode]);

  // Handle Game Over Flow & Global Leaderboard update
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
        userWon = true;
      }

      if (userWon) {
        triggerTelegramHaptic('success');
        triggerNativeHaptic('success');
      } else {
        triggerTelegramHaptic('error');
        triggerNativeHaptic('warning');
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - matchStartTime.current) / 1000));
      const rolePlayed = mode === 'online' && roomInfo ? roomInfo.myRole : aiUserRole;
      const opponentName =
        mode === 'ai'
          ? `AI (${difficulty})`
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

      const winnerName = userWon ? profile.name : opponentName;
      const winnerId = userWon ? `p_${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '')}` : `p_opp_${Date.now()}`;
      const loserName = userWon ? opponentName : profile.name;
      const loserId = userWon ? `p_opp_${Date.now()}` : `p_${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId,
          winnerName,
          loserId,
          loserName,
          winnerRole: isTigerWon ? 'tiger' : 'goat',
          goatsEaten: gameState.goatsCaptured,
        }),
      }).catch((e) => console.warn('Leaderboard report error:', e));
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

  const executeMove = (move: Move) => {
    const currentState = gameStateRef.current;

    if (move.type === 'jump') {
      sound.playAttack();
      triggerTelegramHaptic('heavy');
      triggerNativeHaptic('heavy');
    } else if (move.type === 'place') {
      sound.playPlace('goat');
      triggerTelegramHaptic('light');
      triggerNativeHaptic('light');
    } else {
      sound.playMove(move.piece);
      triggerTelegramHaptic('medium');
      triggerNativeHaptic('medium');
    }

    setHistoryStack((prev) => [...prev, currentState]);
    const nextState = applyMove(currentState, move);

    const beforeTrapped = getTrappedTigersInfo(currentState.board).trappedCount;
    const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
    if (afterTrapped > beforeTrapped) {
      sound.playTrap();
      triggerTelegramHaptic('success');
      triggerNativeHaptic('success');
    }

    setGameState(nextState);
    setSelectedPos(null);

    if (mode === 'online') {
      sendMove(move, nextState);
    }
  };

  const handleNodeClick = (pos: number) => {
    if (!isUserTurn()) return;

    const pieceAtNode = gameState.board[pos];

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

    const matchedMove = validMoves.find((m) => m.to === pos);
    if (matchedMove) {
      executeMove(matchedMove);
      return;
    }

    if (pieceAtNode === gameState.turn) {
      setSelectedPos(selectedPos === pos ? null : pos);
      triggerTelegramHaptic('selection');
      triggerNativeHaptic('light');
      return;
    }

    setSelectedPos(null);
  };

  const handleUndo = () => {
    if (historyStack.length === 0 || mode === 'online' || isAiThinking) return;

    if (mode === 'ai') {
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

  const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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
        <LeaderboardModal
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
          currentPlayerName={profile.name}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (currentScreen === 'setup') {
    return (
      <>
        <GameSetupScreen
          mode={mode}
          aiUserRole={aiUserRole}
          difficulty={difficulty}
          boardTheme={boardTheme}
          timerMode={timerMode}
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
          onSelectTheme={(t) => setBoardTheme(t)}
          onSelectTimer={(tm) => setTimerMode(tm)}
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
        <LeaderboardModal
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
          currentPlayerName={profile.name}
        />
        <OfflineIndicator />
      </>
    );
  }

  const isOpponentTurn = gameState.status === 'playing' && !isUserTurn();

  return (
    <main
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col justify-between overflow-hidden select-none touch-none"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* 1. TOP APP BAR (ONLY 2 ESSENTIALS: Opponent Card + Side Flyout Menu Toggle) */}
      <header className="w-full max-w-lg mx-auto h-16 px-3 flex items-center justify-between shrink-0 bg-stone-950/90 border-b border-stone-850 z-10 backdrop-blur-md">
        {/* Opponent Identity & Live Status */}
        <div
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border transition ${
            isOpponentTurn
              ? 'bg-stone-900 border-amber-500/70 ring-1 ring-amber-500/40 shadow-sm'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center relative ${
              opponentRole === 'tiger'
                ? 'bg-amber-500 text-stone-950'
                : 'bg-slate-200 text-stone-950'
            }`}
          >
            {opponentRole === 'tiger' ? <TigerIcon className="w-4 h-4" /> : <GoatIcon className="w-4 h-4" />}
            {isOpponentTurn && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-stone-100 leading-tight">
              {mode === 'ai'
                ? `AI (${difficulty === 'adaptive' ? adaptiveDetailsLabel(profile) : difficulty})`
                : mode === 'online' && roomInfo
                ? roomInfo.opponentName
                : opponentRole === 'tiger'
                ? 'Tiger Player'
                : 'Goat Player'}
            </span>
            <span className="text-[10px] text-stone-400 font-medium">
              {opponentRole === 'tiger'
                ? `Trapped: ${trappedInfo.trappedCount}/4`
                : `Reserve: ${gameState.goatsInReserve}`}
            </span>
          </div>

          {/* Clock if active */}
          {timerMode !== 'unlimited' && gameState.status === 'playing' && (
            <div
              className={`ml-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                isOpponentTurn
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-stone-950 text-stone-500 border-stone-800'
              }`}
            >
              {timerMode === 'turn30s'
                ? `${isOpponentTurn ? turnSecondsLeft : 30}s`
                : formatClock(blitzClocks[opponentRole])}
            </div>
          )}
        </div>

        {/* SIDE FLYOUT MENU HAMBURGER BUTTON */}
        <button
          onClick={() => setShowSideMenu(true)}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-stone-300 hover:text-white bg-stone-900 border border-stone-800 active:bg-stone-800 transition shadow-sm"
          title="Open Menu"
        >
          <Menu className="w-5 h-5 text-amber-400" />
        </button>
      </header>

      {/* 2. THE CLEAN GAME ARENA (Centered Board & Minimal Turn Beacon) */}
      <section className="flex-1 flex flex-col justify-center items-center w-full max-w-lg mx-auto px-2 overflow-hidden relative">
        {/* Subtle Turn Guidance Pill */}
        <div className="mb-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm transition ${
              gameState.status !== 'playing'
                ? 'bg-amber-500 border-amber-400 text-stone-950 font-black'
                : isUserTurn()
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gameState.status !== 'playing'
                  ? 'bg-stone-950'
                  : isUserTurn()
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-stone-600'
              }`}
            />
            <span>
              {gameState.status !== 'playing'
                ? gameState.status === 'goat_won'
                  ? 'Goats Won!'
                  : 'Tigers Won!'
                : isAiThinking
                ? 'AI Calculating...'
                : isUserTurn()
                ? userRole === 'goat'
                  ? gameState.phase === 'placement'
                    ? `Place Goat (${gameState.goatsInReserve} left)`
                    : 'Your Turn: Move Goat'
                  : 'Your Turn: Move/Leap Tiger'
                : 'Opponent Turn'}
            </span>
          </div>
        </div>

        {/* Baghchal 3D Board Surface */}
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
          theme={boardTheme}
        />
      </section>

      {/* 3. BOTTOM APP BAR (Player Card + Quick Undo Only) */}
      <footer className="w-full max-w-lg mx-auto h-16 px-3 flex items-center justify-between shrink-0 bg-stone-950/90 border-t border-stone-850 z-10 backdrop-blur-md">
        {/* Player Identity Card */}
        <div
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border transition ${
            isUserTurn()
              ? 'bg-stone-900 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-sm'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center relative ${
              userRole === 'goat'
                ? 'bg-slate-200 text-stone-950'
                : 'bg-amber-500 text-stone-950'
            }`}
          >
            {userRole === 'goat' ? <GoatIcon className="w-4 h-4" /> : <TigerIcon className="w-4 h-4" />}
            {isUserTurn() && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-stone-100 leading-tight">
              {profile.name || 'You'} ({userRole === 'goat' ? 'Goat' : 'Tiger'})
            </span>
            <span className="text-[10px] text-stone-400 font-medium">
              {userRole === 'goat'
                ? `Lost: ${gameState.goatsCaptured}/5`
                : `Trapped: ${trappedInfo.trappedCount}/4`}
            </span>
          </div>

          {/* User Turn Clock */}
          {timerMode !== 'unlimited' && gameState.status === 'playing' && (
            <div
              className={`ml-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                isUserTurn()
                  ? turnSecondsLeft <= 5 && timerMode === 'turn30s'
                    ? 'bg-red-950/80 text-red-300 border-red-500 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-stone-950 text-stone-500 border-stone-800'
              }`}
            >
              {timerMode === 'turn30s'
                ? `${isUserTurn() ? turnSecondsLeft : 30}s`
                : formatClock(blitzClocks[userRole])}
            </div>
          )}
        </div>

        {/* Quick Undo Floating Action Button (Only visible when moves can be undone) */}
        <button
          onClick={handleUndo}
          disabled={historyStack.length === 0 || mode === 'online' || isAiThinking}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-semibold transition ${
            historyStack.length === 0 || mode === 'online' || isAiThinking
              ? 'bg-stone-900/40 border-stone-900 text-stone-600 cursor-not-allowed opacity-50'
              : 'bg-stone-900 border-stone-800 text-stone-200 hover:text-white hover:bg-stone-800 active:scale-95 shadow-sm'
          }`}
          title="Undo Last Move"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>
      </footer>

      {/* 4. SIDE FLYOUT MENU DRAWER */}
      <SideDrawer
        isOpen={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        mode={mode}
        canUndo={historyStack.length > 0 && mode !== 'online' && !isAiThinking}
        onUndo={handleUndo}
        onRestart={resetGame}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        boardTheme={boardTheme}
        onSelectTheme={(t) => setBoardTheme(t)}
        onOpenRules={() => setShowRules(true)}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenOnlineLobby={() => setShowOnlineLobby(true)}
        onExitToSetup={() => {
          if (mode === 'online') {
            handleLeaveOnlineRoom();
          }
          setCurrentScreen('setup');
        }}
      />

      {/* Dialog Modals */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        currentPlayerName={profile.name}
      />
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
          setCurrentScreen('setup');
        }}
        onOpenLeaderboard={() => {
          setShowGameOverModal(false);
          setShowLeaderboard(true);
        }}
        onReviewBoard={() => setShowGameOverModal(false)}
      />
      <OfflineIndicator />
    </main>
  );
}

function adaptiveDetailsLabel(profile: PlayerProfile): string {
  const details = getAdaptiveAIDetails(profile);
  return details.tierLabel;
}
