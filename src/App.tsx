import { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, GameState, Move, PlayerRole, AIDifficulty, PlayerProfile, BoardTheme, TimerMode } from './types';
import {
  createInitialGameState,
  applyMove,
  getTrappedTigersInfo,
  getAllGoatMoves,
  getTigerMovesForPos,
} from './game/rules';
import { getAIMove, getAdaptiveAIDetails } from './game/ai';
import { BaghchalLedger, LedgerBlock } from './game/ledger';
import { sound } from './utils/audio';
import { loadPlayerProfile, recordMatchResult, savePlayerProfile } from './utils/storage';
import { triggerNativeHaptic } from './utils/nativeHaptics';
import { useWebRTCGame } from './hooks/useWebRTCGame';
import { BaghchalBoard } from './components/BaghchalBoard';
import { SplashScreen } from './components/SplashScreen';
import { GameSetupScreen } from './components/GameSetupScreen';
import { SideDrawer } from './components/SideDrawer';
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { LedgerFlyMenu } from './components/LedgerFlyMenu';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Menu, RotateCcw } from 'lucide-react';
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
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [mode, setMode] = useState<GameMode>('ai');
  const [aiUserRole, setAiUserRole] = useState<PlayerRole>('goat');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('classic');
  const [timerMode, setTimerMode] = useState<TimerMode>('unlimited');
  const [forfeitDetail, setForfeitDetail] = useState<string | null>(null);

  // Blockchain Ledger State
  const [localLedger] = useState(() => new BaghchalLedger());
  const [ledgerChain, setLedgerChain] = useState<LedgerBlock[]>([]);
  const [showLedgerMenu, setShowLedgerMenu] = useState(false);

  // Audio state
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());

  // Fly Menu SideDrawer & Modals
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  // Match start timestamp
  const matchStartTime = useRef<number>(Date.now());
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  // WebRTC Game Hook
  const {
    roomInfo,
    isSearching,
    matchStatusText,
    dataChannelOpen,
    connectionHealth,
    isOpponentDisconnected,
    disconnectSecondsLeft,
    pingLatencyMs,
    rematchStatus,
    ledgerChain: remoteLedgerChain,
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
  } = useWebRTCGame({
    playerName: profile.name,
    gameState,
    onRemoteMove: async (remoteMove, nextState, block) => {
      if (block) {
        const valid = await localLedger.verifyAndAppendBlock(block);
        if (!valid && nextState.moveHistory) {
          const rebuilt = await BaghchalLedger.reconstructChainFromHistory(nextState.moveHistory);
          localLedger.chain = rebuilt.chain;
          localLedger.pieceMap = rebuilt.pieceMap;
          localLedger.currentGoatIndex = rebuilt.currentGoatIndex;
          localLedger.capturedGoats = rebuilt.capturedGoats;
        }
        setLedgerChain([...localLedger.chain]);
      }

      if (remoteMove?.type === 'jump') {
        sound.playAttack();
        triggerTelegramHaptic('heavy');
        triggerNativeHaptic('heavy');
      } else if (remoteMove?.type === 'place') {
        sound.playPlace('goat');
        triggerTelegramHaptic('light');
        triggerNativeHaptic('light');
      } else if (remoteMove) {
        sound.playMove(remoteMove.piece);
        triggerTelegramHaptic('medium');
        triggerNativeHaptic('medium');
      }

      const beforeTrapped = getTrappedTigersInfo(gameStateRef.current.board).trappedCount;
      const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
      if (afterTrapped > beforeTrapped) {
        sound.playTrap();
        triggerTelegramHaptic('success');
        triggerNativeHaptic('success');
      }

      setGameState(nextState);
      setSelectedPos(null);
    },
    onOpponentResigned: () => {
      const isUserGoat = userRole === 'goat';
      setForfeitDetail('Opponent resigned the match. You win!');
      setGameState((prev) => ({
        ...prev,
        status: isUserGoat ? 'goat_won' : 'tiger_won',
      }));
      sound.playVictory();
      triggerTelegramHaptic('success');
      triggerNativeHaptic('success');
    },
    onOpponentLeft: () => {
      const isUserGoat = userRole === 'goat';
      setForfeitDetail('Opponent left the room. You win by forfeit!');
      setGameState((prev) => ({
        ...prev,
        status: isUserGoat ? 'goat_won' : 'tiger_won',
      }));
      sound.playVictory();
    },
    onOpponentForfeitWin: () => {
      const isUserGoat = userRole === 'goat';
      setForfeitDetail('Opponent forfeited after 30s disconnection. You win!');
      setGameState((prev) => ({
        ...prev,
        status: isUserGoat ? 'goat_won' : 'tiger_won',
      }));
      sound.playVictory();
      triggerTelegramHaptic('success');
      triggerNativeHaptic('success');
    },
    onLocalForfeitLoss: () => {
      const isUserGoat = userRole === 'goat';
      setForfeitDetail('You were disconnected from the match for over 30s.');
      setGameState((prev) => ({
        ...prev,
        status: isUserGoat ? 'tiger_won' : 'goat_won',
      }));
      sound.playDefeat();
      triggerTelegramHaptic('error');
      triggerNativeHaptic('warning');
    },
    onRematchRequested: () => {
      sound.playGameStart();
      triggerTelegramHaptic('medium');
      triggerNativeHaptic('medium');
    },
    onRematchAccepted: () => {
      setForfeitDetail(null);
      resetGame();
      setShowGameOverModal(false);
      sound.playGameStart();
      triggerTelegramHaptic('success');
      triggerNativeHaptic('success');
    },
    onRematchDeclined: () => {
      setForfeitDetail('Opponent declined rematch or left the room.');
    },
  });

  const activeChain =
    mode === 'online'
      ? remoteLedgerChain.length >= ledgerChain.length
        ? remoteLedgerChain
        : ledgerChain
      : ledgerChain;

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
    setForfeitDetail(null);
    resetGame();
    startAutoMatch(role);
  };

  const handleJoinCustomRoom = (roomId: string, asHost: boolean) => {
    setMode('online');
    setForfeitDetail(null);
    resetGame();
    joinCustomRoom(roomId, asHost);
  };

  const handleCancelAutoMatch = () => {
    cancelAutoMatch();
    setMode('ai');
  };

  const handleLeaveOnlineRoom = () => {
    sendLeaveRoom();
    setMode('ai');
    resetGame();
    setShowOnlineLobby(false);
    setShowGameOverModal(false);
  };

  const handleLocalResign = () => {
    sendResign();
    const isUserGoat = userRole === 'goat';
    setForfeitDetail('You conceded the match.');
    setGameState((prev) => ({
      ...prev,
      status: isUserGoat ? 'tiger_won' : 'goat_won',
    }));
    sound.playDefeat();
    triggerTelegramHaptic('error');
    triggerNativeHaptic('warning');
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
      const allGoatMoves = getAllGoatMoves(gameState.board, 0);
      return allGoatMoves.filter((m) => m.from === selectedPos);
    }

    return [];
  }, [gameState, selectedPos, isUserTurn]);

  const validMoves = currentValidMoves();

  const resetGame = useCallback(() => {
    const fresh = createInitialGameState();
    setGameState(fresh);
    setHistoryStack([]);
    setSelectedPos(null);
    setIsAiThinking(false);
    localLedger.reset();
    setLedgerChain([]);
    setForfeitDetail(null);
    matchStartTime.current = Date.now();
  }, [localLedger]);

  // Handle Game Over
  useEffect(() => {
    if (gameState.status !== 'playing') {
      setShowGameOverModal(true);
      const isTigerWon = gameState.status === 'tiger_won';
      const isGoatWon = gameState.status === 'goat_won';

      if (isGoatWon) {
        sound.playGoatMarchVictory();
      } else if (isTigerWon) {
        sound.playAttack();
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
        sound.playVictory();
        triggerTelegramHaptic('success');
        triggerNativeHaptic('success');
      } else {
        sound.playDefeat();
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

      const updated = recordMatchResult(profile, {
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

  // AI Turn Execution
  useEffect(() => {
    if (mode !== 'ai' || gameState.status !== 'playing') return;

    const isAiTurn =
      (aiUserRole === 'goat' && gameState.turn === 'tiger') ||
      (aiUserRole === 'tiger' && gameState.turn === 'goat');

    if (!isAiTurn) return;

    setIsAiThinking(true);
    let isCancelled = false;

    const executeAiMove = async () => {
      try {
        const aiRole: PlayerRole = aiUserRole === 'goat' ? 'tiger' : 'goat';
        const aiMove = await getAIMove(gameState, aiRole, difficulty, profile);
        if (isCancelled) return;

        if (aiMove) {
          await executeMove(aiMove);
        }
      } catch (err) {
        console.error('AI Move calculation failed:', err);
      } finally {
        if (!isCancelled) {
          setIsAiThinking(false);
        }
      }
    };

    const timer = setTimeout(executeAiMove, 450);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [mode, gameState.turn, gameState.status, aiUserRole, difficulty, profile]);

  const executeMove = async (move: Move) => {
    const currentState = gameStateRef.current;
    const nextState = applyMove(currentState, move);

    const capturedPos = move.type === 'jump' ? move.captured : undefined;
    const block = await localLedger.createBlock(currentState.turn, move, capturedPos);
    await localLedger.verifyAndAppendBlock(block);
    setLedgerChain([...localLedger.chain]);

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
    setGameState(nextState);
    setSelectedPos(null);

    const beforeTrapped = getTrappedTigersInfo(currentState.board).trappedCount;
    const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
    if (afterTrapped > beforeTrapped) {
      sound.playTrap();
      triggerTelegramHaptic('success');
      triggerNativeHaptic('success');
    }

    if (mode === 'online') {
      sendMove(move, nextState, block);
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
      }
    } else {
      const targetState = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, prev.length - 1));
      setGameState(targetState);
    }
    setSelectedPos(null);
  };

  const handleToggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
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
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* 1. TOP APP BAR: Opponent Card + Turn Pill + Side Menu Toggle */}
      <header className="w-full max-w-lg mx-auto h-16 px-3 flex items-center justify-between shrink-0 bg-stone-950/90 border-b border-stone-850 z-10 backdrop-blur-md">
        {/* Opponent Identity Card */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border transition ${
            isOpponentTurn
              ? 'bg-stone-900 border-amber-500/70 ring-1 ring-amber-500/40 shadow-sm'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div className="text-base relative">
            {opponentRole === 'tiger' ? '🐅' : '🐐'}
            {isOpponentTurn && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-stone-200 leading-tight">
                {mode === 'ai'
                  ? `AI (${difficulty === 'adaptive' ? getAdaptiveAIDetails(profile).tierLabel : difficulty})`
                  : mode === 'online' && roomInfo
                  ? roomInfo.opponentName
                  : opponentRole === 'tiger'
                  ? 'Tiger Player'
                  : 'Goat Player'}
              </span>
              {mode === 'online' && pingLatencyMs && (
                <span className="text-[9px] font-mono text-emerald-400">
                  {pingLatencyMs}ms
                </span>
              )}
            </div>
            {opponentRole === 'tiger' ? (
              <span className="text-[9px] text-amber-400 font-medium">
                Trapped: <strong className="font-mono text-stone-100">{trappedInfo.trappedCount}/4</strong>
              </span>
            ) : (
              <span className="text-[9px] text-stone-400 font-medium">
                Res: <strong className="font-mono text-amber-300">{gameState.goatsInReserve}</strong> · Eat: <strong className="font-mono text-red-400">{gameState.goatsCaptured}/5</strong>
              </span>
            )}
          </div>
        </div>

        {/* Center: Turn Status Guidance */}
        <div className="flex items-center">
          {gameState.status !== 'playing' ? (
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-stone-950 shadow">
              {gameState.status === 'goat_won' ? 'Goats Won! 🏆' : 'Tigers Won! 🏆'}
            </span>
          ) : isAiThinking ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Thinking...</span>
            </span>
          ) : isUserTurn() ? (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500 text-stone-950 shadow-sm">
              <span>{userRole === 'goat' ? '🐐 Your Turn' : '🐅 Your Turn'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-900 text-stone-400 border border-stone-800">
              <span>{opponentRole === 'goat' ? '🐐 Opponent' : '🐅 Opponent'}</span>
            </span>
          )}
        </div>

        {/* Right: Clean Hamburger Flyout Menu Toggle */}
        <button
          onClick={() => setShowSideMenu(true)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-stone-300 hover:text-white bg-stone-900 border border-stone-800 active:bg-stone-850 transition shadow-sm"
          title="Open Menu"
        >
          <Menu className="w-5 h-5 text-amber-400" />
        </button>
      </header>

      {/* Disconnection Warning & Countdown Banners */}
      {mode === 'online' && (
        connectionHealth === 'local_offline' ? (
          <div className="w-full max-w-lg mx-auto mb-1 flex items-center justify-between px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs shadow-lg animate-pulse z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span className="font-semibold">You are offline. Reconnecting to internet...</span>
            </div>
            <button
              onClick={attemptManualReconnect}
              className="text-[11px] font-bold text-red-100 bg-red-800/80 hover:bg-red-700 px-2 py-0.5 rounded border border-red-600/50 active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        ) : isOpponentDisconnected ? (
          <div className="w-full max-w-lg mx-auto mb-1 flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs shadow-lg animate-pulse z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-semibold">Opponent connection lost. Waiting...</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono font-bold text-amber-300 bg-stone-900/80 px-2 py-0.5 rounded border border-amber-600/40">
                Forfeit in {disconnectSecondsLeft}s
              </div>
              <button
                onClick={attemptManualReconnect}
                className="text-[10px] font-bold text-amber-100 bg-amber-800/60 hover:bg-amber-700 px-1.5 py-0.5 rounded border border-amber-600/40 active:scale-95 transition"
              >
                Check
              </button>
            </div>
          </div>
        ) : null
      )}

      {/* Rematch Incoming Banner (when modal minimized) */}
      {mode === 'online' && rematchStatus === 'requested_by_opponent' && !showGameOverModal && (
        <div className="w-full max-w-lg mx-auto mb-1 flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-100 text-xs shadow-xl animate-bounce z-20">
          <span className="font-bold">🐅 Opponent requested a rematch!</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={acceptRematch}
              className="bg-emerald-600 hover:bg-emerald-500 text-stone-950 px-2.5 py-1 rounded-lg font-bold text-xs"
            >
              Accept
            </button>
            <button
              onClick={declineRematch}
              className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-1 rounded-lg font-medium text-xs"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* 2. THE CLEAN GAME ARENA */}
      <section className="flex-1 flex items-center justify-center w-full max-w-lg mx-auto overflow-hidden p-1">
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

      {/* 3. BOTTOM APP BAR: Player Card + Quick Undo Floating Button */}
      <footer className="w-full max-w-lg mx-auto h-16 px-3 flex items-center justify-between shrink-0 bg-stone-950/90 border-t border-stone-850 z-10 backdrop-blur-md">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border transition ${
            isUserTurn()
              ? 'bg-stone-900 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-sm'
              : 'bg-stone-900/60 border-stone-800'
          }`}
        >
          <div className="text-base">{userRole === 'goat' ? '🐐' : '🐅'}</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-stone-200 leading-tight">
              {profile.name || 'You'} ({userRole === 'goat' ? 'Goat' : 'Tiger'})
            </span>
            {userRole === 'goat' ? (
              <span className="text-[9px] text-stone-400 font-medium">
                Reserve: <strong className="font-mono text-amber-300">{gameState.goatsInReserve}</strong> · Eaten: <strong className="font-mono text-red-400">{gameState.goatsCaptured}/5</strong>
              </span>
            ) : (
              <span className="text-[9px] text-stone-400 font-medium">
                Trapped: <strong className="font-mono text-amber-400">{trappedInfo.trappedCount}/4</strong>
              </span>
            )}
          </div>
        </div>

        {/* Quick Undo Button (Single action in footer) */}
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
        onResignMatch={handleLocalResign}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        boardTheme={boardTheme}
        onSelectTheme={(t) => setBoardTheme(t)}
        onOpenRules={() => setShowRules(true)}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenOnlineLobby={() => setShowOnlineLobby(true)}
        onOpenLedger={() => setShowLedgerMenu(true)}
        onExitToSetup={() => {
          if (mode === 'online') {
            handleLeaveOnlineRoom();
          }
          setCurrentScreen('setup');
        }}
      />

      {/* 5. VERIFIABLE MOVE LEDGER FLY MENU */}
      <LedgerFlyMenu
        isOpen={showLedgerMenu}
        onClose={() => setShowLedgerMenu(false)}
        chain={activeChain}
      />

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
        userRole={userRole}
        goatsCaptured={gameState.goatsCaptured}
        totalTurns={gameState.moveHistory.length}
        isOnline={mode === 'online'}
        rematchStatus={rematchStatus}
        forfeitDetail={forfeitDetail}
        onRequestRematch={requestRematch}
        onAcceptRematch={acceptRematch}
        onDeclineRematch={declineRematch}
        onPlayAgain={() => {
          resetGame();
          setShowGameOverModal(false);
        }}
        onChangeMode={() => {
          if (mode === 'online') {
            handleLeaveOnlineRoom();
          } else {
            resetGame();
          }
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
