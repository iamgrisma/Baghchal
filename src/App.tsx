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
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  RotateCcw,
  RefreshCw,
  Trophy,
  Award,
  Clock,
  Settings,
  X,
  Palette,
  BookOpen,
  LogOut,
  HelpCircle,
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

  // Modals & In-Game Menu Drawer
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showInGameMenu, setShowInGameMenu] = useState(false);
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
      if (currentScreen === 'play') {
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

  // Current turn indicator values
  const isOpponentTurn = gameState.status === 'playing' && !isUserTurn();

  return (
    <main
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col justify-between overflow-hidden select-none touch-none"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* 1. Android Material Top App Bar */}
      <header className="w-full max-w-lg mx-auto h-14 px-3 flex items-center justify-between shrink-0 bg-stone-950 border-b border-stone-850 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (mode === 'online') {
                handleLeaveOnlineRoom();
              }
              setCurrentScreen('setup');
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-900 active:bg-stone-800 transition"
            title="Exit to Setup"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-stone-100 leading-tight">
              {mode === 'ai' ? 'Match vs Computer' : mode === 'online' ? 'Online Match' : 'Pass & Play'}
            </h1>
            <span className="text-[10px] text-stone-400 font-medium">
              {mode === 'ai' ? `Level: ${difficulty}` : 'Baghchal Arena'}
            </span>
          </div>
        </div>

        {/* Trailing: Sound Toggle & Options Drawer Button */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleSound}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-900 active:bg-stone-800 transition"
            title="Audio Mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={() => setShowInGameMenu(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-900 active:bg-stone-800 transition"
            title="Game Options"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. THE UNIFIED TWO-PLAYER GAME ARENA */}
      <section className="flex-1 flex flex-col justify-evenly items-center w-full max-w-lg mx-auto px-3 py-1 overflow-hidden">
        {/* OPPONENT CARD (Directly above the board) */}
        <div
          className={`w-full max-w-[min(94vw,460px)] rounded-2xl bg-stone-900/90 border px-3 py-2 flex items-center justify-between shadow-sm transition ${
            isOpponentTurn
              ? 'border-amber-500/60 ring-1 ring-amber-500/40 bg-stone-900'
              : 'border-stone-800/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${
                opponentRole === 'tiger'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'bg-slate-200 text-stone-950 font-bold'
              }`}
            >
              {opponentRole === 'tiger' ? <TigerIcon className="w-5 h-5" /> : <GoatIcon className="w-5 h-5" />}
              {isOpponentTurn && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-stone-100 leading-tight">
                {mode === 'ai'
                  ? `AI Engine (${difficulty === 'adaptive' ? adaptiveDetailsLabel(profile) : difficulty})`
                  : mode === 'online' && roomInfo
                  ? roomInfo.opponentName
                  : opponentRole === 'tiger'
                  ? 'Tiger Commander'
                  : 'Goat Herder'}
              </div>
              <div className="text-[11px] text-stone-400">
                {opponentRole === 'tiger' ? '4 Tigers' : '20 Goats'}
              </div>
            </div>
          </div>

          {/* Opponent Tactical Counters & Clock */}
          <div className="flex items-center gap-2">
            {timerMode !== 'unlimited' && gameState.status === 'playing' && (
              <div
                className={`px-2 py-0.5 rounded-lg font-mono text-xs font-bold border ${
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

            {opponentRole === 'tiger' ? (
              <div className="flex items-center gap-1 bg-stone-950 px-2 py-1 rounded-xl border border-stone-800">
                <span className="text-[10px] text-stone-400 font-semibold uppercase">Trapped</span>
                <span className="font-mono text-xs font-black text-amber-400">{trappedInfo.trappedCount}/4</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-stone-950 px-2 py-1 rounded-xl border border-stone-800 text-[11px] font-mono">
                <span className="text-stone-300">Reserve: <strong className="text-amber-300">{gameState.goatsInReserve}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* BAGHCHAL BOARD SURFACE */}
        <div className="w-full flex items-center justify-center my-1">
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
        </div>

        {/* INTEGRATED TACTICAL GUIDANCE RIBBON */}
        <div className="w-full max-w-[min(94vw,460px)] px-3 py-1 rounded-xl bg-stone-900/60 border border-stone-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-stone-300 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                gameState.status !== 'playing'
                  ? 'bg-amber-400'
                  : isUserTurn()
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-stone-600'
              }`}
            />
            <span>
              {gameState.status !== 'playing'
                ? gameState.status === 'goat_won'
                  ? 'Match Concluded: Goats Trapped All Tigers!'
                  : 'Match Concluded: Tigers Hunted 5 Goats!'
                : isAiThinking
                ? 'Computer is analyzing board positions...'
                : isUserTurn()
                ? userRole === 'goat'
                  ? gameState.phase === 'placement'
                    ? `Your Turn: Place Goat (${gameState.goatsInReserve} in reserve)`
                    : 'Your Turn: Select and move goat along grid lines'
                  : 'Your Turn: Select tiger to leap or move'
                : 'Waiting for opponent move...'}
            </span>
          </div>

          <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
            {gameState.phase === 'placement' ? 'Placement' : 'Movement'}
          </span>
        </div>

        {/* PLAYER CARD (Directly below the board) */}
        <div
          className={`w-full max-w-[min(94vw,460px)] rounded-2xl bg-stone-900/90 border px-3 py-2 flex items-center justify-between shadow-sm transition ${
            isUserTurn()
              ? 'border-emerald-500/60 ring-1 ring-emerald-500/40 bg-stone-900'
              : 'border-stone-800/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${
                userRole === 'goat'
                  ? 'bg-slate-200 text-stone-950 font-bold'
                  : 'bg-amber-500 text-stone-950 font-bold'
              }`}
            >
              {userRole === 'goat' ? <GoatIcon className="w-5 h-5" /> : <TigerIcon className="w-5 h-5" />}
              {isUserTurn() && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-stone-100 leading-tight">
                {profile.name || 'You'} (Commander)
              </div>
              <div className="text-[11px] text-stone-400">
                {userRole === 'goat' ? '20 Goats' : '4 Tigers'}
              </div>
            </div>
          </div>

          {/* User Tactical Counters & Clock */}
          <div className="flex items-center gap-2">
            {timerMode !== 'unlimited' && gameState.status === 'playing' && (
              <div
                className={`px-2 py-0.5 rounded-lg font-mono text-xs font-bold border ${
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

            {userRole === 'goat' ? (
              <div className="flex items-center gap-2 bg-stone-950 px-2 py-1 rounded-xl border border-stone-800 text-[11px] font-mono">
                <span className="text-stone-300">Reserve: <strong className="text-amber-300">{gameState.goatsInReserve}</strong></span>
                <span className="text-stone-300">Eaten: <strong className="text-red-400">{gameState.goatsCaptured}/5</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-stone-950 px-2 py-1 rounded-xl border border-stone-800">
                <span className="text-[10px] text-stone-400 font-semibold uppercase">Trapped</span>
                <span className="font-mono text-xs font-black text-amber-400">{trappedInfo.trappedCount}/4</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. CLEAN BOTTOM MATERIAL GAME ACTION BAR */}
      <footer className="w-full max-w-lg mx-auto p-2 bg-stone-950 border-t border-stone-850 shrink-0">
        <div className="w-full max-w-[min(94vw,460px)] mx-auto grid grid-cols-4 gap-1.5 bg-stone-900 border border-stone-800 p-1 rounded-2xl shadow-md">
          {/* Action 1: Undo */}
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || mode === 'online' || isAiThinking}
            className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold transition ${
              historyStack.length === 0 || mode === 'online' || isAiThinking
                ? 'text-stone-600 cursor-not-allowed'
                : 'text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700'
            }`}
          >
            <RotateCcw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Undo</span>
          </button>

          {/* Action 2: Restart */}
          <button
            onClick={() => {
              resetGame();
              if (mode === 'online') sendRestart();
            }}
            className="flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700 transition"
          >
            <RefreshCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Restart</span>
          </button>

          {/* Action 3: Game Rules */}
          <button
            onClick={() => setShowRules(true)}
            className="flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700 transition"
          >
            <HelpCircle className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Rules</span>
          </button>

          {/* Action 4: Leaderboard */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-stone-800 active:bg-stone-700 transition"
          >
            <Trophy className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Ranks</span>
          </button>
        </div>
      </footer>

      {/* 4. IN-GAME MATERIAL OPTIONS BOTTOM SHEET / MODAL */}
      {showInGameMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in select-none">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-stone-100">Match Settings</h2>
              </div>
              <button
                onClick={() => setShowInGameMenu(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Board Theme Picker */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Board Theme</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'classic', label: 'Woodland', color: 'bg-amber-500' },
                  { id: 'slate', label: 'Highland', color: 'bg-cyan-400' },
                  { id: 'midnight', label: 'Obsidian', color: 'bg-purple-400' },
                ].map(({ id, label, color }) => (
                  <button
                    key={id}
                    onClick={() => setBoardTheme(id as BoardTheme)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition ${
                      boardTheme === id
                        ? 'bg-stone-850 border-amber-400 text-stone-100 ring-1 ring-amber-400/50'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${color}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowInGameMenu(false);
                  setShowRules(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-850 transition"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>How to Play Baghchal</span>
                </span>
                <span className="text-stone-500">View Rules</span>
              </button>

              <button
                onClick={() => {
                  setShowInGameMenu(false);
                  setShowLeaderboard(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-850 transition"
              >
                <span className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Global Leaderboard</span>
                </span>
                <span className="text-stone-500">Hall of Fame</span>
              </button>

              <button
                onClick={() => {
                  setShowInGameMenu(false);
                  if (mode === 'online') {
                    handleLeaveOnlineRoom();
                  }
                  setCurrentScreen('setup');
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-xs font-bold text-red-300 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Exit Match to Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
