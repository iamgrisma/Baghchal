import { AIDifficulty, GameState, Move, PieceType, PlayerProfile, PlayerRole } from '../types';
import {
  ADJACENCY,
  applyMove,
  getAllGoatMoves,
  getAllTigerMoves,
  getTigerMovesForPos,
  getTrappedTigersInfo,
} from './rules';

// Board connections count (corners=3, edges=3 or 5, inner=4 or 8)
const CONNECTIVITY = [
  3, 3, 5, 3, 3,
  3, 8, 4, 8, 3,
  5, 4, 8, 4, 5,
  3, 8, 4, 8, 3,
  3, 3, 5, 3, 3,
];

// High-value opening positions for goats that don't give immediate diagonals to all 4 corner tigers:
// Strong perimeter and diamond buffer nodes:
const GOAT_PREFERRED_OPENINGS = [2, 10, 14, 22, 6, 8, 16, 18, 7, 11, 13, 17];

/**
 * Adaptive AI detail information based on player's win rate and match history.
 */
export interface AdaptiveAIDetails {
  effectiveDifficulty: 'easy' | 'medium' | 'hard';
  winRate: number; // 0..100
  totalAiGames: number;
  aiWins: number;
  playerWins: number;
  recentForm: ('W' | 'L')[];
  tierLabel: string; // e.g. "Hard ⚡", "Medium ⚖️", "Easy 🛡️"
  statusBadge: string; // e.g. "Mastery Surge", "Dynamic Equilibrium", "Adaptive Relief"
  description: string;
}

/**
 * Dynamically evaluates the player's performance across multiple games and calculates
 * the optimal AI difficulty setting.
 *
 * Rules:
 * - High win rate (>= 60%) or hot streak (2+ wins) -> Elevates to Hard (depth 3, zero tactical blunders)
 * - Low win rate (< 38%) or cold streak (2+ losses) -> Dials down to Easy (relaxed lookahead, gives tactical room)
 * - Moderate win rate (38-59%) or new calibration -> Balances at Medium (depth 2, strategic openings)
 */
export function getAdaptiveAIDetails(profile?: PlayerProfile): AdaptiveAIDetails {
  if (!profile || !profile.history || profile.history.length === 0) {
    return {
      effectiveDifficulty: 'medium',
      winRate: 50,
      totalAiGames: 0,
      aiWins: 0,
      playerWins: 0,
      recentForm: [],
      tierLabel: 'Medium ⚖️',
      statusBadge: 'Calibrating',
      description: 'Initial calibration: AI starts at balanced Medium and tunes to your results.',
    };
  }

  // Filter for AI matches, or all matches if no AI-tagged matches exist
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
      tierLabel: 'Medium ⚖️',
      statusBadge: 'Calibrating',
      description: 'Initial calibration: AI starts at balanced Medium and tunes to your results.',
    };
  }

  const playerWins = relevantMatches.filter((m) => m.result === 'won').length;
  const aiWins = relevantMatches.length - playerWins;
  const winRate = Math.round((playerWins / relevantMatches.length) * 100);

  // Recent 5 matches for momentum and streak detection
  const recent = relevantMatches.slice(0, 5);
  const recentWins = recent.filter((m) => m.result === 'won').length;
  const recentWinRate = recent.length > 0 ? Math.round((recentWins / recent.length) * 100) : winRate;
  const recentForm = recent.map((m) => (m.result === 'won' ? 'W' : 'L') as 'W' | 'L');

  // Streak detection from recent matches
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
  let tierLabel = 'Medium ⚖️';
  let statusBadge = 'Balanced';
  let description = '';

  // Dynamic adaptation based on win rate across multiple games:
  // 1. High win rate or hot streak -> Escalate to Hard
  if (
    (relevantMatches.length >= 2 && winRate >= 60) ||
    (currentStreakIsWin && streakCount >= 2) ||
    (recent.length >= 3 && recentWinRate >= 65)
  ) {
    effectiveDifficulty = 'hard';
    tierLabel = 'Hard ⚡';
    statusBadge = 'Mastery Surge';
    description = `Win rate: ${winRate}% (${playerWins}W - ${aiWins}L). AI dialed up to Hard with deep lookahead to challenge your mastery!`;
  }
  // 2. Low win rate or cold streak -> Scale back to Easy
  else if (
    (relevantMatches.length >= 2 && winRate < 38) ||
    (!currentStreakIsWin && streakCount >= 2) ||
    (recent.length >= 3 && recentWinRate <= 25)
  ) {
    effectiveDifficulty = 'easy';
    tierLabel = 'Easy 🛡️';
    statusBadge = 'Adaptive Relief';
    description = `Win rate: ${winRate}% (${playerWins}W - ${aiWins}L). AI dialed down to Easy to provide space to develop counter-strategies.`;
  }
  // 3. Balanced win rate -> Medium
  else {
    effectiveDifficulty = 'medium';
    tierLabel = 'Medium ⚖️';
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

/**
 * Checks if a candidate move allows a tiger to immediately jump and capture on the very next turn.
 */
export function allowsImmediateTigerCapture(state: GameState, move: Move): boolean {
  const nextState = applyMove(state, move);
  const tigerMoves = getAllTigerMoves(nextState.board);
  return tigerMoves.some((m) => m.type === 'jump');
}

/**
 * Evaluates whether a goat at a given position is safe from any current tiger jump.
 */
function isGoatUnderAttack(board: (PieceType | null)[], goatPos: number): boolean {
  const tigerMoves = getAllTigerMoves(board);
  return tigerMoves.some((m) => m.type === 'jump' && m.captured === goatPos);
}

/**
 * Static evaluation from Tiger's perspective (positive = good for Tigers, negative = good for Goats).
 */
function evaluateState(state: GameState, difficulty: AIDifficulty): number {
  if (state.status === 'tiger_won') return 100000;
  if (state.status === 'goat_won') return -100000;

  let score = 0;

  // 1. Captured Goats (5 captures = win for Tigers)
  score += state.goatsCaptured * 2200;

  // 2. Trapped Tigers & Tiger mobility
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

  // 3. Goat strategic formation (Safety, Clustering, Wall formation, Corner Trapping)
  let goatSafeCount = 0;
  let goatClusteredPairs = 0;

  for (let i = 0; i < 25; i++) {
    if (state.board[i] === 'goat') {
      // Check if goat is safe from attack
      if (!isGoatUnderAttack(state.board, i)) {
        goatSafeCount++;
      }

      // Check mutual protection: adjacent goats create shields and blocked landing squares
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

  // Corner entrapment bonus for goats (tigers at corners 0, 4, 20, 24 have only 3 neighbors)
  const corners = [0, 4, 20, 24];
  for (const c of corners) {
    if (state.board[c] === 'tiger') {
      const neighbors = ADJACENCY[c];
      const blockedNeighbors = neighbors.filter((n) => state.board[n] === 'goat').length;
      if (blockedNeighbors === 3) {
        score -= 400; // Completely cornered
      } else if (blockedNeighbors === 2) {
        score -= 150; // Heavily pressured
      }
    }
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
  isMaximizing: boolean, // true = Tiger, false = Goat
  difficulty: AIDifficulty
): number {
  if (depth === 0 || state.status !== 'playing') {
    return evaluateState(state, difficulty);
  }

  if (isMaximizing) {
    // Tiger's turn
    let maxEval = -Infinity;
    const moves = getAllTigerMoves(state.board);

    if (moves.length === 0) {
      return -100000; // All tigers trapped
    }

    // Move ordering: jumps first for faster beta cut-offs
    moves.sort((a, b) => (b.type === 'jump' ? 1 : 0) - (a.type === 'jump' ? 1 : 0));

    for (const move of moves) {
      const nextState = applyMove(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, false, difficulty);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    // Goat's turn
    let minEval = Infinity;
    const moves = getAllGoatMoves(state.board, state.goatsInReserve);

    if (moves.length === 0) {
      return 100000; // No moves
    }

    // Safe move filtering & sorting for Goats
    // Prioritize moves that do NOT allow immediate tiger capture
    let candidateMoves = moves;

    if (moves.length > 10) {
      // Sort: moves that avoid capture first, then by mutual support
      moves.sort((a, b) => {
        const aSafe = allowsImmediateTigerCapture(state, a) ? 1 : 0;
        const bSafe = allowsImmediateTigerCapture(state, b) ? 1 : 0;
        return aSafe - bSafe;
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
    return minEval;
  }
}

/**
 * Computes the best move for the AI opponent based on the requested strategic rules:
 * - Easy mode: Not careless from beginning; up to the 11th goat placed, avoids immediate tiger captures and targets safe spots.
 * - Medium mode: Strategically avoids captures and hides behind pieces for at least up to the 16th goat placed.
 * - Hard mode: Plays as hard as it can; does not deterministically fixate on center; optimizes traps and safe wall formations.
 */
export async function getAIMove(
  state: GameState,
  role: PlayerRole,
  difficulty: AIDifficulty,
  profile?: PlayerProfile
): Promise<Move | null> {
  const isTiger = role === 'tiger';
  const availableMoves = isTiger
    ? getAllTigerMoves(state.board)
    : getAllGoatMoves(state.board, state.goatsInReserve);

  if (availableMoves.length === 0) return null;

  // Resolve adaptive difficulty to effective difficulty ('easy' | 'medium' | 'hard')
  const activeDifficulty: 'easy' | 'medium' | 'hard' =
    difficulty === 'adaptive'
      ? getAdaptiveAIDetails(profile).effectiveDifficulty
      : difficulty;

  // 1. Immediate Jump Capture Priority for Tigers (Tigers always take free kills unless easy blunders)
  if (isTiger) {
    const jumps = availableMoves.filter((m) => m.type === 'jump');
    if (jumps.length > 0) {
      if (activeDifficulty === 'hard') {
        // Evaluate which jump leads to best continuation
        if (jumps.length === 1) return jumps[0];
      } else if (activeDifficulty === 'medium' || (activeDifficulty === 'easy' && Math.random() < 0.85)) {
        return jumps[Math.floor(Math.random() * jumps.length)];
      }
    }
  }

  // 2. Goat Placement Rules per Difficulty:
  // - Easy mode: Not careless from beginning; up to the 11th goat placed, avoids immediate tiger captures and targets safe spots.
  // - Medium mode: Strategically avoids captures and hides behind pieces for at least up to the 16th goat placed.
  // - Hard mode: Plays as hard as it can; does not deterministically fixate on center; optimizes traps and safe wall formations.
  if (!isTiger && state.phase === 'placement') {
    const goatsPlacedSoFar = 20 - state.goatsInReserve;

    // A. Opening Move Variety (Goat #1):
    // "Goat always starting from center on hard mode is not that good."
    if (goatsPlacedSoFar === 0) {
      // Pick strategically from diverse strong opening hubs (edges/diamonds) with no immediate jump threat
      const safeOpenings = GOAT_PREFERRED_OPENINGS.filter((pos) =>
        !allowsImmediateTigerCapture(state, { type: 'place', to: pos, piece: 'goat' })
      );
      if (safeOpenings.length > 0) {
        // Diverse non-center opening
        const chosenPos = safeOpenings[Math.floor(Math.random() * safeOpenings.length)];
        return { type: 'place', to: chosenPos, piece: 'goat' };
      }
    }

    // Determine if we must enforce strict safe placement (no suicide moves)
    let enforceStrategicSafety = false;
    if (activeDifficulty === 'hard') {
      enforceStrategicSafety = true; // Always play as hard as it can
    } else if (activeDifficulty === 'medium' && goatsPlacedSoFar < 16) {
      enforceStrategicSafety = true; // Up to 16th goat
    } else if (activeDifficulty === 'easy' && goatsPlacedSoFar < 11) {
      enforceStrategicSafety = true; // Up to 11th goat
    }

    if (enforceStrategicSafety) {
      // Filter out any placement that allows an immediate tiger jump!
      const strictlySafeMoves = availableMoves.filter(
        (m) => !allowsImmediateTigerCapture(state, m)
      );

      if (strictlySafeMoves.length > 0) {
        // Score safe moves by shelter & clustering ("targeting to hide spot behind without being attacked")
        const scoredSafeMoves = strictlySafeMoves.map((m) => {
          let score = 0;
          const nextState = applyMove(state, m);

          // Check if placed behind/adjacent to existing goats (formation of safe chains)
          for (const neighbor of ADJACENCY[m.to]) {
            if (state.board[neighbor] === 'goat') {
              score += 35; // Mutual shield
            } else if (state.board[neighbor] === 'tiger') {
              // Pressuring a tiger without being jumpable is good!
              score += 25;
            }
          }

          // Trapped tiger check
          const trappedAfter = getTrappedTigersInfo(nextState.board).trappedCount;
          score += trappedAfter * 150;

          // Add slight jitter for hard/medium mode variety among equally great spots
          score += Math.random() * 8;

          return { move: m, score };
        });

        scoredSafeMoves.sort((a, b) => b.score - a.score);

        if (activeDifficulty === 'hard') {
          // In hard mode, run minimax on the top 4 candidate moves for deep lookahead
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

        // For Medium and Easy (within safe phase), pick from the top-scoring safe formations
        return scoredSafeMoves[0].move;
      }
    }
  }

  // 3. Easy Difficulty (outside initial 11 goats): occasional relaxed play
  if (activeDifficulty === 'easy') {
    if (Math.random() < 0.4) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
  }

  // 4. Standard Minimax Search for Active Difficulty
  const searchDepth = activeDifficulty === 'hard' ? 3 : activeDifficulty === 'medium' ? 2 : 1;

  let bestMove: Move = availableMoves[0];
  let bestScore = isTiger ? -Infinity : Infinity;

  // Yield thread briefly for smooth UI frame rate
  await new Promise((resolve) => setTimeout(resolve, 25));

  // If goat in hard mode, filter out suicidal moves if alternatives exist
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

    // Add tiny randomized tie-breaker (less than 2 points) so openings and responses feel organic
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
