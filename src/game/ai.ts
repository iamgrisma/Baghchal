import { AIDifficulty, GameState, Move, PieceType, PlayerRole } from '../types';
import {
  ADJACENCY,
  applyMove,
  getAllGoatMoves,
  getAllTigerMoves,
  getTigerMovesForPos,
  getTrappedTigersInfo,
} from './rules';

// Strategic weights for board positions (positions with 8 connections are strategically critical)
const POSITION_WEIGHTS = [
  4, 2, 6, 2, 4,
  2, 5, 3, 5, 2,
  6, 3, 8, 3, 6, // center (12) is 8-way hub
  2, 5, 3, 5, 2,
  4, 2, 6, 2, 4,
];

/**
 * Static evaluation of game state from Tiger's perspective (positive = good for Tigers, negative = good for Goats).
 */
function evaluateState(state: GameState): number {
  if (state.status === 'tiger_won') return 100000;
  if (state.status === 'goat_won') return -100000;

  let score = 0;

  // 1. Captured Goats (5 captures = win)
  score += state.goatsCaptured * 1500;

  // 2. Count tiger moves & trapped tigers in a single unified pass
  let trappedCount = 0;
  let tigerMovesCount = 0;
  let captureMovesCount = 0;

  for (let i = 0; i < 25; i++) {
    const piece = state.board[i];
    if (piece === 'tiger') {
      const moves = getTigerMovesForPos(state.board, i);
      if (moves.length === 0) {
        trappedCount++;
      } else {
        tigerMovesCount += moves.length;
        for (const m of moves) {
          if (m.type === 'jump') captureMovesCount++;
        }
      }
      score += POSITION_WEIGHTS[i] * 12;
    } else if (piece === 'goat') {
      score -= POSITION_WEIGHTS[i] * 8;

      // Check for goat locks: adjacent goats protecting each other
      let adjacentGoats = 0;
      for (const neighbor of ADJACENCY[i]) {
        if (state.board[neighbor] === 'goat') {
          adjacentGoats++;
        }
      }
      if (adjacentGoats >= 2) {
        score -= 25; // Good for goats
      }
    }
  }

  score -= trappedCount * 450;
  score += tigerMovesCount * 28;
  score += captureMovesCount * 400;

  // 3. Placement phase considerations
  if (state.phase === 'placement') {
    score -= state.goatsInReserve * 15;
  }

  return score;
}

/**
 * Minimax algorithm with Alpha-Beta pruning
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean // true = Tiger, false = Goat
): number {
  if (depth === 0 || state.status !== 'playing') {
    return evaluateState(state);
  }

  if (isMaximizing) {
    // Tiger's turn
    let maxEval = -Infinity;
    const moves = getAllTigerMoves(state.board);

    if (moves.length === 0) {
      return -100000; // All tigers trapped
    }

    // Sort moves: jump captures first for maximum alpha-beta cut-offs
    moves.sort((a, b) => (b.type === 'jump' ? 1 : 0) - (a.type === 'jump' ? 1 : 0));

    for (const move of moves) {
      const nextState = applyMove(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Beta cut-off
    }
    return maxEval;
  } else {
    // Goat's turn
    let minEval = Infinity;
    const moves = getAllGoatMoves(state.board, state.goatsInReserve);

    if (moves.length === 0) {
      return 100000; // No moves
    }

    // Limit branching in placement phase to high-value strategic positions
    let moveSubset = moves;
    if (state.phase === 'placement' && moves.length > 8) {
      moves.sort((a, b) => POSITION_WEIGHTS[b.to] - POSITION_WEIGHTS[a.to]);
      moveSubset = moves.slice(0, 8);
    } else if (moves.length > 12) {
      moves.sort((a, b) => POSITION_WEIGHTS[b.to] - POSITION_WEIGHTS[a.to]);
      moveSubset = moves.slice(0, 10);
    }

    for (const move of moveSubset) {
      const nextState = applyMove(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Alpha cut-off
    }
    return minEval;
  }
}

/**
 * Computes the best move for the AI opponent based on difficulty.
 */
export async function getAIMove(
  state: GameState,
  role: PlayerRole,
  difficulty: AIDifficulty
): Promise<Move | null> {
  const isTiger = role === 'tiger';
  const availableMoves = isTiger
    ? getAllTigerMoves(state.board)
    : getAllGoatMoves(state.board, state.goatsInReserve);

  if (availableMoves.length === 0) return null;

  // Immediate jump capture priority for Tiger
  if (isTiger) {
    const jumps = availableMoves.filter((m) => m.type === 'jump');
    if (jumps.length === 1 && difficulty !== 'easy') {
      return jumps[0];
    }
  }

  // Easy difficulty: occasional blunder or random move
  if (difficulty === 'easy') {
    if (isTiger) {
      const jumps = availableMoves.filter((m) => m.type === 'jump');
      if (jumps.length > 0 && Math.random() < 0.7) {
        return jumps[Math.floor(Math.random() * jumps.length)];
      }
    }
    if (Math.random() < 0.45) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
  }

  // Determine search depth (balanced for high-speed computation and tactical sharpness)
  let searchDepth = 2;
  if (difficulty === 'easy') searchDepth = 1;
  else if (difficulty === 'medium') searchDepth = 2;
  else if (difficulty === 'hard') searchDepth = 3;

  let bestMove: Move = availableMoves[0];
  let bestScore = isTiger ? -Infinity : Infinity;

  // Yield thread briefly for smooth UI
  await new Promise((resolve) => setTimeout(resolve, 30));

  for (const move of availableMoves) {
    const nextState = applyMove(state, move);
    const score = minimax(
      nextState,
      searchDepth - 1,
      -Infinity,
      Infinity,
      !isTiger
    );

    if (isTiger) {
      const adjustedScore = score + (Math.random() * 4 - 2);
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    } else {
      const adjustedScore = score + (Math.random() * 4 - 2);
      if (adjustedScore < bestScore) {
        bestScore = adjustedScore;
        bestMove = move;
      }
    }
  }

  return bestMove;
}
