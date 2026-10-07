import { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, GameState, Move, PlayerRole, AIDifficulty, PlayerProfile } from './types';
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
import { useWebRTCGame } from './hooks/useWebRTCGame';
import { BaghchalBoard } from './components/BaghchalBoard';
import { SplashScreen } from './components/SplashScreen';
import { GameSetupScreen } from './components/GameSetupScreen';
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { LedgerFlyMenu } from './components/LedgerFlyMenu';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
  Trophy,
  Award,
  Link2,
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
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [mode, setMode] = useState<GameMode>('ai');
  const [aiUserRole, setAiUserRole] = useState<PlayerRole>('goat');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [profile, setProfile] = useState<PlayerProfile>(loadPlayerProfile);

  // Blockchain Ledger State (Audit & Fly Menu Log)
  const [localLedger] = useState(() => new BaghchalLedger());
  const [ledgerChain, setLedgerChain] = useState<LedgerBlock[]>([]);
  const [showLedgerMenu, setShowLedgerMenu] = useState(false);

  // Audio mute
  const [isMuted, setIsMuted] = useState(() => sound.isMuted());

  // Modals
  const [showRules, setShowRules] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  // Timer reference for match duration
  const matchStartTime = useRef<number>(Date.now());
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  // WebRTC Game Hook with Upstash Redis fallback & 30s forfeit handling
  const {
    roomInfo,
    isSearching,
    matchStatusText,
    dataChannelOpen,
    isOpponentDisconnected,
    disconnectSecondsLeft,
    ledgerChain: remoteLedgerChain,
    startAutoMatch,
    cancelAutoMatch,
    joinCustomRoom,
    sendMove,
    sendRestart,
    cleanupConnection,
  } = useWebRTCGame({
    playerName: profile.name,
    gameState,
    onRemoteMove: async (remoteMove, nextState, block) => {
      if (block) {
        await localLedger.verifyAndAppendBlock(block);
        setLedgerChain([...localLedger.chain]);
      }

      if (remoteMove?.type === 'jump') {
        sound.playAttack();
        triggerTelegramHaptic('heavy');
      } else if (remoteMove?.type === 'place') {
        sound.playPlace('goat');
        triggerTelegramHaptic('light');
      } else if (remoteMove) {
        sound.playMove(remoteMove.piece);
        triggerTelegramHaptic('medium');
      }

      const beforeTrapped = getTrappedTigersInfo(gameStateRef.current.board).trappedCount;
      const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
      if (afterTrapped > beforeTrapped) {
        sound.playTrap();
        triggerTelegramHaptic('success');
      }

      setGameState(nextState);
      setSelectedPos(null);
    },
    onRemoteRestart: () => {
      resetGame();
      try {
        sound.playGameStart();
      } catch (e) {}
    },
    onOpponentForfeitWin: () => {
      const isUserGoat = userRole === 'goat';
      setGameState((prev) => ({
        ...prev,
        status: isUserGoat ? 'goat_won' : 'tiger_won',
      }));
      try {
        if (isUserGoat) {
          sound.playGoatMarchVictory();
        } else {
          sound.playAttack();
        }
        triggerTelegramHaptic('success');
      } catch (e) {}
    },
  });

  const activeChain = mode === 'online' && remoteLedgerChain.length > 0 ? remoteLedgerChain : ledgerChain;

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

  // Compute strictly valid moves using core rules engine
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
    matchStartTime.current = Date.now();
  }, [localLedger]);

  // Handle Game Over Flow & Global Leaderboard update
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
      } else {
        sound.playDefeat();
        triggerTelegramHaptic('error');
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

    // 1. Standard deterministic rules engine execution
    const nextState = applyMove(currentState, move);

    // 2. Mint and append Blockchain Ledger Block for Audit/FlyMenu
    const capturedPos = move.type === 'jump' ? move.captured : undefined;
    const block = await localLedger.createBlock(currentState.turn, move, capturedPos);
    await localLedger.verifyAndAppendBlock(block);
    setLedgerChain([...localLedger.chain]);

    if (move.type === 'jump') {
      sound.playAttack();
      triggerTelegramHaptic('heavy');
    } else if (move.type === 'place') {
      sound.playPlace('goat');
      triggerTelegramHaptic('light');
    } else {
      sound.playMove(move.piece);
      triggerTelegramHaptic('medium');
    }

    setHistoryStack((prev) => [...prev, currentState]);
    setGameState(nextState);
    setSelectedPos(null);

    const beforeTrapped = getTrappedTigersInfo(currentState.board).trappedCount;
    const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
    if (afterTrapped > beforeTrapped) {
      sound.playTrap();
      triggerTelegramHaptic('success');
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
      {/* 1. TOP GAME HUD */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between gap-1.5 px-1 py-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (mode === 'online') {
                handleLeaveOnlineRoom();
              }
              setCurrentScreen('setup');
            }}
            className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 border border-stone-800 text-xs transition active:scale-95 shadow-sm"
            title="Back to Game Setup"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

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
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[9px] text-stone-400 font-medium">
                  <span>Reserve: <strong className="font-mono text-amber-300">{gameState.goatsInReserve}</strong></span>
                  <span>Eaten: <strong className="font-mono text-red-400">{gameState.goatsCaptured}/5</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Turn Status Pill */}
        <div className="flex items-center">
          {gameState.status !== 'playing' ? (
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-stone-950 shadow">
              {gameState.status === 'goat_won' ? 'Goats Won! 🏆' : 'Tigers Won! 🏆'}
            </span>
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
              <span>{opponentRole === 'goat' ? '🐐' : '🐅'} Opponent Turn</span>
            </span>
          )}
        </div>

        {/* Right: Quick Action Icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLedgerMenu(true)}
            className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 border border-stone-800 text-xs transition active:scale-95 shadow-sm relative"
            title="Inspect Blockchain Ledger"
          >
            <Link2 className="w-4 h-4" />
            {activeChain.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-3.5 h-3.5 rounded-full bg-amber-500 text-stone-950 font-mono text-[9px] font-black flex items-center justify-center">
                {activeChain.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 border border-stone-800 text-xs transition active:scale-95 shadow-sm"
            title="Global Leaderboard"
          >
            <Trophy className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs transition active:scale-95 shadow-sm"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Opponent Disconnection / 30s Forfeit Warning Banner */}
      {mode === 'online' && isOpponentDisconnected && (
        <div className="w-full max-w-lg mx-auto mb-1 flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs shadow-lg animate-pulse z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold">Opponent offline. Reconnecting...</span>
          </div>
          <div className="font-mono font-bold text-amber-300 bg-stone-900/80 px-2 py-0.5 rounded border border-amber-600/40">
            Forfeit in {disconnectSecondsLeft}s
          </div>
        </div>
      )}

      {/* 2. Board Arena */}
      <section className="flex-1 flex items-center justify-center w-full max-w-lg mx-auto overflow-hidden p-0.5 sm:p-1">
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
      </section>

      {/* 3. Bottom Player Stats & Controls */}
      <footer className="w-full max-w-lg mx-auto flex flex-col gap-1.5 shrink-0 px-1 pb-1">
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
              <span className="text-stone-300">
                Eaten: <strong className="font-mono text-red-400">{gameState.goatsCaptured}/5</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-stone-300">Trapped:</span>
              <strong className="font-mono text-amber-400">{trappedInfo.trappedCount}/4</strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || mode === 'online' || isAiThinking}
            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition ${
              historyStack.length === 0 || mode === 'online' || isAiThinking
                ? 'bg-stone-900/40 text-stone-600 border border-stone-900 cursor-not-allowed'
                : 'bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 active:scale-95 shadow'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          <button
            onClick={() => {
              resetGame();
              if (mode === 'online') sendRestart();
            }}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-bold transition active:scale-95 shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => {
              if (mode === 'online') {
                handleLeaveOnlineRoom();
              }
              setCurrentScreen('setup');
            }}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-black transition active:scale-95 shadow"
          >
            <span>🎮 Mode</span>
          </button>

          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-amber-300 border border-amber-600/30 text-xs font-bold transition active:scale-95 shadow"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Ranks</span>
          </button>
        </div>
      </footer>

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
        onPlayAgain={() => {
          resetGame();
          if (mode === 'online') sendRestart();
          setShowGameOverModal(false);
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
      <LedgerFlyMenu
        isOpen={showLedgerMenu}
        onClose={() => setShowLedgerMenu(false)}
        chain={activeChain}
      />
      <OfflineIndicator />
    </main>
  );
}
