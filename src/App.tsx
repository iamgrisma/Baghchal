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
import { getAIMove } from './game/ai';
import { sound } from './utils/audio';
import { loadPlayerProfile, recordMatchResult, savePlayerProfile } from './utils/storage';
import { useWebRTCGame } from './hooks/useWebRTCGame';
import { BaghchalBoard } from './components/BaghchalBoard';
import { Scoreboard } from './components/Scoreboard';
import { GameControls } from './components/GameControls';
import { RulesModal } from './components/RulesModal';
import { ProfileModal } from './components/ProfileModal';
import { OnlineLobbyModal } from './components/OnlineLobbyModal';
import { GameOverModal } from './components/GameOverModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
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
      // Play sound according to remote move
      if (remoteMove.type === 'jump') sound.playAttack();
      else if (remoteMove.type === 'place') sound.playPlace();
      else sound.playMove();

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
      // In placement phase, any empty node is a valid placement target
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
      let userWon = false;

      if (mode === 'ai') {
        userWon = isTigerWon ? aiUserRole === 'tiger' : aiUserRole === 'goat';
      } else if (mode === 'online' && roomInfo) {
        userWon = isTigerWon ? roomInfo.myRole === 'tiger' : roomInfo.myRole === 'goat';
      } else {
        // Local 2-player
        userWon = true;
      }

      if (userWon) sound.playVictory();
      else sound.playDefeat();

      // Record profile statistics
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
    }
  }, [gameState.status]);

  // AI Turn Handler
  useEffect(() => {
    if (
      mode === 'ai' &&
      gameState.status === 'playing' &&
      gameState.turn !== aiUserRole &&
      !isAiThinking
    ) {
      setIsAiThinking(true);

      const timer = setTimeout(async () => {
        const aiRole: PlayerRole = aiUserRole === 'goat' ? 'tiger' : 'goat';
        const bestMove = await getAIMove(gameState, aiRole, difficulty);

        if (bestMove) {
          executeMove(bestMove);
        }
        setIsAiThinking(false);
      }, 450);

      return () => clearTimeout(timer);
    }
  }, [mode, gameState.turn, gameState.status, aiUserRole, difficulty, isAiThinking]);

  // Execute a verified Move
  const executeMove = (move: Move) => {
    // Sound effect
    if (move.type === 'jump') {
      sound.playAttack();
    } else if (move.type === 'place') {
      sound.playPlace();
    } else {
      sound.playMove();
    }

    setHistoryStack((prev) => [...prev, gameState]);
    const nextState = applyMove(gameState, move);

    // Check if tiger became trapped for sound
    const beforeTrapped = trappedInfo.trappedCount;
    const afterTrapped = getTrappedTigersInfo(nextState.board).trappedCount;
    if (afterTrapped > beforeTrapped) {
      sound.playTrap();
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
      // Toggle selection or select new
      setSelectedPos(selectedPos === pos ? null : pos);
      return;
    }

    // 4. Clicked outside valid options
    setSelectedPos(null);
  };

  // Undo Move (Local or AI mode)
  const handleUndo = () => {
    if (historyStack.length === 0 || mode === 'online') return;

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

    setSelectedPos(null);
    setShowGameOverModal(false);
    sound.playMove();
  };

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between py-1 sm:py-3 px-2 sm:px-4">
      {/* Top Navigation & Brand Header */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between pb-1.5 border-b border-stone-800/80 px-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 shadow-md ring-1 ring-amber-400/30 flex items-center justify-center font-black text-stone-950 text-base">
            🐅
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-wider text-amber-400 leading-tight">
              BAGHCHAL
            </h1>
            <p className="text-[10px] text-stone-400 font-medium tracking-wide">
              बाघचाल · 4 Tigers vs. 20 Goats
            </p>
          </div>
        </div>

        {/* Action Controls & PWA Install Button */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Game Arena */}
      <section className="flex-1 flex flex-col items-center justify-center my-1 sm:my-2 w-full max-w-xl mx-auto">
        {/* Scoreboard and Turn Tracking */}
        <Scoreboard
          turn={gameState.turn}
          phase={gameState.phase}
          status={gameState.status}
          goatsInReserve={gameState.goatsInReserve}
          goatsCaptured={gameState.goatsCaptured}
          trappedTigersCount={trappedInfo.trappedCount}
          gameMode={mode}
          opponentName={mode === 'online' && roomInfo ? roomInfo.opponentName : undefined}
          playerRole={mode === 'online' && roomInfo ? roomInfo.myRole : mode === 'ai' ? aiUserRole : undefined}
        />

        {/* Authentic Baghchal Board */}
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

        {/* Controls, Modes, and Options */}
        <GameControls
          mode={mode}
          difficulty={difficulty}
          aiUserRole={aiUserRole}
          isMuted={isMuted}
          canUndo={historyStack.length > 0}
          onSelectMode={(newMode) => {
            setMode(newMode);
            resetGame();
          }}
          onSelectDifficulty={(d) => setDifficulty(d)}
          onSelectAIRole={(r) => {
            setAiUserRole(r);
            resetGame();
          }}
          onUndo={handleUndo}
          onRestart={() => {
            resetGame();
            if (mode === 'online') sendRestart();
          }}
          onToggleSound={handleToggleSound}
          onOpenRules={() => setShowRules(true)}
          onOpenProfile={() => setShowProfile(true)}
          onOpenOnlineLobby={() => setShowOnlineLobby(true)}
        />
      </section>

      {/* Footer Heritage Note */}
      <footer className="w-full max-w-xl mx-auto pt-2 pb-1 text-center text-[10px] text-stone-500 border-t border-stone-900/60 px-2">
        Nepali Traditional Board Game · Offline PWA &amp; WebRTC Multiplayer
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
        onReviewBoard={() => setShowGameOverModal(false)}
      />

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />
    </main>
  );
}
