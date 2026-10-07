import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AIDifficulty,
  BoardTheme,
  GameMode,
  GameState,
  Move,
  PieceType,
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

  // Modals
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

  return (
    <main
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] bg-stone-950 text-stone-100 flex flex-col justify-between overflow-hidden select-none touch-none px-2 py-1 xs:py-1.5"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* 1. Android Material Top App Bar */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between gap-2 px-1 py-1 shrink-0 h-14 bg-stone-900/90 rounded-2xl border border-stone-800/80 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (mode === 'online') {
                handleLeaveOnlineRoom();
              }
              setCurrentScreen('setup');
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700 transition"
            title="Navigate to Match Setup"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 pl-1 border-l border-stone-800">
            <div className="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center text-amber-400">
              {opponentRole === 'tiger' ? <TigerIcon className="w-4 h-4" /> : <GoatIcon className="w-4 h-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-stone-200 leading-tight">
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
          </div>
        </div>

        {/* Center/Trailing: Turn Status Card & Clock */}
        <div className="flex items-center gap-1.5 pr-1">
          {timerMode !== 'unlimited' && gameState.status === 'playing' && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-mono font-bold border transition ${
                timerMode === 'turn30s' && turnSecondsLeft <= 5
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : 'bg-stone-950 border-stone-800 text-amber-300'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>
                {timerMode === 'turn30s' ? `${turnSecondsLeft}s` : formatClock(blitzClocks[gameState.turn])}
              </span>
            </div>
          )}

          <div
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              gameState.status !== 'playing'
                ? 'bg-amber-500 border-amber-400 text-stone-950 font-black'
                : isUserTurn()
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-stone-950 border-stone-800 text-stone-400'
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
                ? 'Game Over'
                : isAiThinking
                ? 'Thinking...'
                : isUserTurn()
                ? 'Your Turn'
                : 'Opponent'}
            </span>
          </div>

          <button
            onClick={handleToggleSound}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition"
            title="Audio Toggle"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* 2. Board Arena Container */}
      <section className="flex-1 flex items-center justify-center w-full max-w-lg mx-auto overflow-hidden p-0.5">
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

      {/* 3. Android Material Bottom App & Action Bar */}
      <footer className="w-full max-w-lg mx-auto flex flex-col gap-1.5 shrink-0 px-1 pb-1">
        {/* Status Dashboard Tile */}
        <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800/80 rounded-2xl px-3 py-1.5 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-amber-400">
              {userRole === 'goat' ? <GoatIcon className="w-3.5 h-3.5" /> : <TigerIcon className="w-3.5 h-3.5" />}
            </div>
            <span className="font-bold text-stone-200">
              {profile.name || 'You'} ({userRole === 'goat' ? 'Goat' : 'Tiger'})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {userRole === 'goat' ? (
              <>
                <span className="text-stone-400">
                  Reserve: <strong className="text-amber-300">{gameState.goatsInReserve}</strong>
                </span>
                <span className="text-stone-400">
                  Lost: <strong className="text-red-400">{gameState.goatsCaptured}/5</strong>
                </span>
              </>
            ) : (
              <span className="text-stone-400">
                Trapped: <strong className="text-amber-400">{trappedInfo.trappedCount}/4</strong>
              </span>
            )}
          </div>
        </div>

        {/* Android Material Bottom Bar Actions (48dp height minimum touch targets) */}
        <div className="grid grid-cols-4 gap-1.5 bg-stone-900/95 border border-stone-800/80 p-1 rounded-2xl shadow-lg">
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || mode === 'online' || isAiThinking}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-xs font-semibold transition ${
              historyStack.length === 0 || mode === 'online' || isAiThinking
                ? 'text-stone-600 cursor-not-allowed'
                : 'text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-750'
            }`}
          >
            <RotateCcw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Undo</span>
          </button>

          <button
            onClick={() => {
              resetGame();
              if (mode === 'online') sendRestart();
            }}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-750 transition"
          >
            <RefreshCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Reset</span>
          </button>

          <button
            onClick={() => {
              if (mode === 'online') {
                handleLeaveOnlineRoom();
              }
              setCurrentScreen('setup');
            }}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-750 transition"
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Setup</span>
          </button>

          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-stone-800 active:bg-stone-750 transition"
          >
            <Award className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Leaderboard</span>
          </button>
        </div>
      </footer>

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
