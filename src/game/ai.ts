import { AIDifficulty, GameState, Move, PieceType, PlayerProfile, PlayerRole } from '../types';
import {
  ADJACENCY,
  applyMove,
  getAllGoatMoves,
  getAllTigerMoves,
  getPositionHash,
  getTigerMovesForPos,
  getTrappedTigersInfo,
} from './rules';

// High-value opening positions for goats that don't give immediate diagonals to all 4 corner tigers:
const GOAT_PREFERRED_OPENINGS = [2, 10, 14, 22, 6, 8, 16, 18, 7, 11, 13, 17];
const HUB_NODES = new Set([12, 6, 8, 16, 18, 2, 10, 14, 22]);

// Transposition table cache for fast alpha-beta lookups
const transpositionTable = new Map<string, { depth: number; score: number }>();

export interface AdaptiveAIDetails {
  effectiveDifficulty: 'easy' | 'medium' | 'hard';
  winRate: number;
  totalAiGames: number;
  aiWins: number;
  playerWins: number;
  recentForm: ('W' | 'L')[];
  tierLabel: string;
  statusBadge: string;
  description: string;
}

export function getAdaptiveAIDetails(profile?: PlayerProfile): AdaptiveAIDetails {
  if (!profile || !profile.history || profile.history.length === 0) {
    return {
      effectiveDifficulty: 'medium',
      winRate: 50,
      totalAiGames: 0,
      aiWins: 0,
      playerWins: 0,
      recentForm: [],
      tierLabel: 'Medium (Balanced)',
      statusBadge: 'Calibrating',
      description: 'Initial calibration: AI starts at balanced Medium and tunes to your results.',
    };
  }

  const aiMatches = profile.history.filter((m) => m.mode === 'ai');
  const relevantMatches = aiMatches.length >= 1 ? aiMatches : profile.history;

  if (relevantMatches.length === 0) {
    return {
      effectiveDifficulty: 'medium',
      winRate: 50,
      totalAiGames: 0,
      aiWins: 0,
      playerWins: 0,
      recentForm: [],
      tierLabel: 'Medium (Balanced)',
      statusBadge: 'Calibrating',
      description: 'Initial calibration: AI starts at balanced Medium and tunes to your results.',
    };
  }

  const playerWins = relevantMatches.filter((m) => m.result === 'won').length;
  const aiWins = relevantMatches.length - playerWins;
  const winRate = Math.round((playerWins / relevantMatches.length) * 100);

  const recent = relevantMatches.slice(0, 5);
  const recentWins = recent.filter((m) => m.result === 'won').length;
  const recentWinRate = recent.length > 0 ? Math.round((recentWins / recent.length) * 100) : winRate;
  const recentForm = recent.map((m) => (m.result === 'won' ? 'W' : 'L') as 'W' | 'L');

  let currentStreakIsWin = false;
  let streakCount = 0;
  if (recent.length > 0) {
    const firstResult = recent[0].result;
    currentStreakIsWin = firstResult === 'won';
    for (const m of recent) {
      if (m.result === firstResult) streakCount++;
      else break;
    }
  }

  let effectiveDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  let tierLabel = 'Medium (Balanced)';
  let statusBadge = 'Balanced';
  let description = '';

  if (
    (relevantMatches.length >= 2 && winRate >= 60) ||
    (currentStreakIsWin && streakCount >= 2) ||
    (recent.length >= 3 && recentWinRate >= 65)
  ) {
    effectiveDifficulty = 'hard';
    tierLabel = 'Hard (Mastery)';
    statusBadge = 'Mastery Surge';
    description = `Win rate: ${winRate}% (${playerWins}W - ${aiWins}L). AI dialed up to Hard with deep lookahead to challenge your mastery!`;
  } else if (
    (relevantMatches.length >= 2 && winRate < 38) ||
    (!currentStreakIsWin && streakCount >= 2) ||
    (recent.length >= 3 && recentWinRate <= 25)
  ) {
    effectiveDifficulty = 'easy';
    tierLabel = 'Easy (Casual)';
    statusBadge = 'Adaptive Relief';
    description = `Win rate: ${winRate}% (${playerWins}W - ${aiWins}L). AI dialed down to Easy to provide space to develop counter-strategies.`;
  } else {
    effectiveDifficulty = 'medium';
    tierLabel = 'Medium (Balanced)';
    statusBadge = 'Dynamic Equilibrium';
    description = `Win rate: ${winRate}% (${playerWins}W - ${aiWins}L). AI maintaining Medium difficulty for a balanced, competitive match.`;
  }

  return {
    effectiveDifficulty,
    winRate,
    totalAiGames: relevantMatches.length,
    aiWins,
    playerWins,
    recentForm,
    tierLabel,
    statusBadge,
    description,
  };
}

export function allowsImmediateTigerCapture(state: GameState, move: Move): boolean {
  const nextState = applyMove(state, move);
  const tigerMoves = getAllTigerMoves(nextState.board);
  return tigerMoves.some((m) => m.type === 'jump');
}

function isGoatUnderAttack(board: (PieceType | null)[], goatPos: number): boolean {
  const tigerMoves = getAllTigerMoves(board);
  return tigerMoves.some((m) => m.type === 'jump' && m.captured === goatPos);
}

function evaluateState(state: GameState, difficulty: AIDifficulty): number {
  if (state.status === 'tiger_won') return 100000;
  if (state.status === 'goat_won') return -100000;

  let score = 0;
  score += state.goatsCaptured * 2200;

  const trappedInfo = getTrappedTigersInfo(state.board);
  score -= trappedInfo.trappedCount * 650;

  let totalTigerMoves = 0;
  let immediateCaptureThreats = 0;

  for (let i = 0; i < 25; i++) {
    if (state.board[i] === 'tiger' && !trappedInfo.trappedIndices.includes(i)) {
      const moves = getTigerMovesForPos(state.board, i);
      totalTigerMoves += moves.length;
      for (const m of moves) {
        if (m.type === 'jump') {
          immediateCaptureThreats++;
        }
      }
    }
  }

  score += totalTigerMoves * 32;
  score += immediateCaptureThreats * 550;

  let goatSafeCount = 0;
  let goatClusteredPairs = 0;

  for (let i = 0; i < 25; i++) {
    if (state.board[i] === 'goat') {
      if (!isGoatUnderAttack(state.board, i)) {
        goatSafeCount++;
      }

      let adjacentGoats = 0;
      for (const neighbor of ADJACENCY[i]) {
        if (state.board[neighbor] === 'goat') {
          adjacentGoats++;
        }
      }

      if (adjacentGoats >= 1) {
        goatClusteredPairs += adjacentGoats;
      }
    }
  }

  score -= goatSafeCount * 25;
  score -= Math.min(goatClusteredPairs * 18, 280);

  const corners = [0, 4, 20, 24];
  for (const c of corners) {
    if (state.board[c] === 'tiger') {
      const neighbors = ADJACENCY[c];
      const blockedNeighbors = neighbors.filter((n) => state.board[n] === 'goat').length;
      if (blockedNeighbors === 3) {
        score -= 400;
      } else if (blockedNeighbors === 2) {
        score -= 150;
      }
    }
  }

  return score;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  difficulty: AIDifficulty
): number {
  if (depth === 0 || state.status !== 'playing') {
    return evaluateState(state, difficulty);
  }

  const hash = getPositionHash(state.board, state.turn, state.goatsInReserve, state.goatsCaptured);
  const cached = transpositionTable.get(hash);
  if (cached && cached.depth >= depth) {
    return cached.score;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    const moves = getAllTigerMoves(state.board);

    if (moves.length === 0) {
      return -100000;
    }

    moves.sort((a, b) => {
      const jumpDiff = (b.type === 'jump' ? 100 : 0) - (a.type === 'jump' ? 100 : 0);
      if (jumpDiff !== 0) return jumpDiff;
      return (HUB_NODES.has(b.to) ? 10 : 0) - (HUB_NODES.has(a.to) ? 10 : 0);
    });

    for (const move of moves) {
      const nextState = applyMove(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, false, difficulty);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }

    if (transpositionTable.size < 40000) {
      transpositionTable.set(hash, { depth, score: maxEval });
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    const moves = getAllGoatMoves(state.board, state.goatsInReserve);

    if (moves.length === 0) {
      return 100000;
    }

    let candidateMoves = moves;

    if (moves.length > 10) {
      moves.sort((a, b) => {
        const aSafe = allowsImmediateTigerCapture(state, a) ? 1 : 0;
        const bSafe = allowsImmediateTigerCapture(state, b) ? 1 : 0;
        if (aSafe !== bSafe) return aSafe - bSafe;
        return (HUB_NODES.has(b.to) ? 1 : 0) - (HUB_NODES.has(a.to) ? 1 : 0);
      });
      candidateMoves = moves.slice(0, 10);
    }

    for (const move of candidateMoves) {
      const nextState = applyMove(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, true, difficulty);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }

    if (transpositionTable.size < 40000) {
      transpositionTable.set(hash, { depth, score: minEval });
    }
    return minEval;
  }
}

export async function getAIMove(
  state: GameState,
  role: PlayerRole,
  difficulty: AIDifficulty,
  profile?: PlayerProfile
): Promise<Move | null> {
  if (transpositionTable.size > 30000) {
    transpositionTable.clear();
  }

  const isTiger = role === 'tiger';
  const availableMoves = isTiger
    ? getAllTigerMoves(state.board)
    : getAllGoatMoves(state.board, state.goatsInReserve);

  if (availableMoves.length === 0) return null;

  const activeDifficulty: 'easy' | 'medium' | 'hard' =
    difficulty === 'adaptive'
      ? getAdaptiveAIDetails(profile).effectiveDifficulty
      : difficulty;

  if (isTiger) {
    const jumps = availableMoves.filter((m) => m.type === 'jump');
    if (jumps.length > 0) {
      if (activeDifficulty === 'hard') {
        if (jumps.length === 1) return jumps[0];
      } else if (activeDifficulty === 'medium' || (activeDifficulty === 'easy' && Math.random() < 0.85)) {
        return jumps[Math.floor(Math.random() * jumps.length)];
      }
    }
  }

  if (!isTiger && state.phase === 'placement') {
    const goatsPlacedSoFar = 20 - state.goatsInReserve;

    if (goatsPlacedSoFar === 0) {
      const safeOpenings = GOAT_PREFERRED_OPENINGS.filter((pos) =>
        !allowsImmediateTigerCapture(state, { type: 'place', to: pos, piece: 'goat' })
      );
      if (safeOpenings.length > 0) {
        const chosenPos = safeOpenings[Math.floor(Math.random() * safeOpenings.length)];
        return { type: 'place', to: chosenPos, piece: 'goat' };
      }
    }

    let enforceStrategicSafety = false;
    if (activeDifficulty === 'hard') {
      enforceStrategicSafety = true;
    } else if (activeDifficulty === 'medium' && goatsPlacedSoFar < 16) {
      enforceStrategicSafety = true;
    } else if (activeDifficulty === 'easy' && goatsPlacedSoFar < 11) {
      enforceStrategicSafety = true;
    }

    if (enforceStrategicSafety) {
      const strictlySafeMoves = availableMoves.filter(
        (m) => !allowsImmediateTigerCapture(state, m)
      );

      if (strictlySafeMoves.length > 0) {
        const scoredSafeMoves = strictlySafeMoves.map((m) => {
          let score = 0;
          const nextState = applyMove(state, m);

          for (const neighbor of ADJACENCY[m.to]) {
            if (state.board[neighbor] === 'goat') {
              score += 35;
            } else if (state.board[neighbor] === 'tiger') {
              score += 25;
            }
          }

          const trappedAfter = getTrappedTigersInfo(nextState.board).trappedCount;
          score += trappedAfter * 150;
          score += Math.random() * 8;

          return { move: m, score };
        });

        scoredSafeMoves.sort((a, b) => b.score - a.score);

        if (activeDifficulty === 'hard') {
          const topCandidates = scoredSafeMoves.slice(0, 4).map((s) => s.move);
          let bestMove = topCandidates[0];
          let bestScore = Infinity;

          for (const move of topCandidates) {
            const nextState = applyMove(state, move);
            const score = minimax(nextState, 2, -Infinity, Infinity, true, 'hard');
            if (score < bestScore) {
              bestScore = score;
              bestMove = move;
            }
          }
          return bestMove;
        }

        return scoredSafeMoves[0].move;
      }
    }
  }

  if (activeDifficulty === 'easy') {
    if (Math.random() < 0.4) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
  }

  const searchDepth = activeDifficulty === 'hard' ? 3 : activeDifficulty === 'medium' ? 2 : 1;

  let bestMove: Move = availableMoves[0];
  let bestScore = isTiger ? -Infinity : Infinity;

  await new Promise((resolve) => setTimeout(resolve, 25));

  let candidateMoves = availableMoves;
  if (!isTiger && activeDifficulty === 'hard') {
    const nonSuicideMoves = availableMoves.filter(
      (m) => !allowsImmediateTigerCapture(state, m)
    );
    if (nonSuicideMoves.length > 0) {
      candidateMoves = nonSuicideMoves;
    }
  }

  for (const move of candidateMoves) {
    const nextState = applyMove(state, move);
    const score = minimax(
      nextState,
      searchDepth - 1,
      -Infinity,
      Infinity,
      !isTiger,
      activeDifficulty
    );

    const jitter = Math.random() * 2 - 1;
    const adjustedScore = score + jitter;

    if (isTiger) {
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    } else {
      if (adjustedScore < bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    }
  }

  return bestMove;
}
