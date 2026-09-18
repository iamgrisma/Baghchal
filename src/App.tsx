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
  // Navigation Screens: 'splash' -> 'setup' -> 'play'
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');

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
    startAutoMatch,
    cancelAutoMatch,
    joinCustomRoom,
    sendMove,
    sendRestart,
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
      joinCustomRoom(deepRoom, false);
      setCurrentScreen('play');
    }
  }, []);

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
      if (!roomInfo) return false;
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

      // Play specific thematic victory sounds:
      // "On final trap i.e if goat wins a march sound of goats myaa myaa twice (but all 20 myaa together😅)"
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

    // If online, broadcast to remote peer via WebRTC / KV
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
          onStartAutoMatch={(pref) => startAutoMatch(pref)}
          onCancelAutoMatch={cancelAutoMatch}
          onJoinCustomRoom={(roomId, asHost) => joinCustomRoom(roomId, asHost)}
        />
        <OfflineIndicator />
      </>
    );
  }

  // Render Screen 3: Immersive Full Screen Play Arena (Model Game Type View)
  return (
    <main className="h-screen h-dvh max-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between overflow-hidden select-none px-2 sm:px-4 py-1.5">
      {/* 1. Minimal Header & Quick Controls */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between pb-1 border-b border-stone-800/80 px-1">
        {/* Back to Setup Menu */}
        <button
          id="play-back-menu-btn"
          onClick={() => setCurrentScreen('setup')}
          className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-amber-400 border border-stone-800 text-xs font-semibold transition"
          title="Back to Setup Menu"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Menu</span>
        </button>

        {/* Turn Indicator Pill */}
        <div className="flex items-center gap-2">
          {gameState.status !== 'playing' ? (
            <div className="px-3 py-1 rounded-full text-xs font-black bg-stone-800 text-stone-300 border border-stone-700">
              Game Finished
            </div>
          ) : isAiThinking ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 ring-2 ring-amber-400/50 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span>AI Thinking...</span>
            </div>
          ) : gameState.turn === 'goat' ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-slate-200 text-slate-900 ring-2 ring-slate-400/50 shadow-sm">
              <span className="text-sm">🐐</span>
              <span>Goat's Turn</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 ring-2 ring-amber-400/50 shadow-sm">
              <span className="text-sm">🐅</span>
              <span>Tiger's Turn</span>
            </div>
          )}
        </div>

        {/* Minimal Quick Actions (Sound, Undo, Restart, Rules) */}
        <div className="flex items-center gap-1">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border border-stone-800 text-xs transition"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-stone-500" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={historyStack.length === 0 || mode === 'online' || isAiThinking}
            className={`p-1.5 rounded-lg border text-xs transition ${
              historyStack.length === 0 || mode === 'online' || isAiThinking
                ? 'bg-stone-950 text-stone-600 border-stone-900 cursor-not-allowed'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border-stone-800 active:scale-95'
            }`}
            title="Undo Move"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Restart */}
          <button
            onClick={() => {
              resetGame();
              if (mode === 'online') sendRestart();
            }}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border border-stone-800 text-xs transition active:scale-95"
            title="Restart Match"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Rules */}
          <button
            onClick={() => setShowRules(true)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border border-stone-800 text-xs transition"
            title="Game Rules"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Online Lobby button if online */}
          {mode === 'online' && (
            <button
              onClick={() => setShowOnlineLobby(true)}
              className="p-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800 text-xs transition"
              title="Online Lobby"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Minimal Space: Tiger Attack & Trap HUD */}
      <MinimalGameHUD
        turn={gameState.turn}
        phase={gameState.phase}
        status={gameState.status}
        goatsInReserve={gameState.goatsInReserve}
        goatsCaptured={gameState.goatsCaptured}
        trappedTigersCount={trappedInfo.trappedCount}
        gameMode={mode}
        opponentName={mode === 'online' && roomInfo ? roomInfo.opponentName : undefined}
        playerRole={mode === 'online' && roomInfo ? roomInfo.myRole : mode === 'ai' ? aiUserRole : undefined}
        isAiThinking={isAiThinking}
      />

      {/* 3. Full Immersive Board Arena (Model Game Type View) */}
      <section className="flex-1 flex items-center justify-center w-full max-w-xl mx-auto overflow-hidden p-0.5 sm:p-1">
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

      {/* 4. Minimal Mode/Match Status Footer */}
      <footer className="w-full max-w-xl mx-auto flex items-center justify-between text-[10px] text-stone-500 pt-0.5 border-t border-stone-900/60 px-2">
        <span>
          {mode === 'ai'
            ? difficulty === 'adaptive'
              ? `vs Adaptive AI (${getAdaptiveAIDetails(profile).tierLabel} · ${getAdaptiveAIDetails(profile).winRate}% Win Rate) · You play ${aiUserRole}`
              : `vs AI (${difficulty}) · You play ${aiUserRole}`
            : mode === 'online'
            ? roomInfo
              ? `Online Room: ${roomInfo.roomId}`
              : 'Online Multiplayer'
            : 'Friend Mode (Pass & Play)'}
        </span>
        <button
          onClick={() => setShowProfile(true)}
          className="text-stone-400 hover:text-amber-400 flex items-center gap-1 transition"
        >
          <Trophy className="w-3 h-3 text-amber-400" />
          <span>Stats</span>
        </button>
      </footer>

      {/* Modals */}
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
        onStartAutoMatch={(pref) => startAutoMatch(pref)}
        onCancelAutoMatch={cancelAutoMatch}
        onJoinCustomRoom={(roomId, asHost) => joinCustomRoom(roomId, asHost)}
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
          setCurrentScreen('setup');
        }}
        onReviewBoard={() => setShowGameOverModal(false)}
      />

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />
    </main>
  );
}
