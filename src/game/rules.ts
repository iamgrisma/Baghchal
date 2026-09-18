import { Board, GamePhase, GameState, Move, PieceType, PlayerRole } from '../types';

/**
 * 5x5 Grid positions: 0 to 24
 * row = Math.floor(index / 5)
 * col = index % 5
 */

// Precomputed adjacency list for each of the 25 nodes
export const ADJACENCY: number[][] = Array.from({ length: 25 }, (_, i) => {
  const r = Math.floor(i / 5);
  const c = i % 5;
  const neighbors: number[] = [];

  // Orthogonal neighbors (always valid if in bounds)
  if (r > 0) neighbors.push((r - 1) * 5 + c);
  if (r < 4) neighbors.push((r + 1) * 5 + c);
  if (c > 0) neighbors.push(r * 5 + (c - 1));
  if (c < 4) neighbors.push(r * 5 + (c + 1));

  // Diagonal neighbors (only valid if (r + c) is even in Baghchal geometry)
  if ((r + c) % 2 === 0) {
    if (r > 0 && c > 0) neighbors.push((r - 1) * 5 + (c - 1));
    if (r > 0 && c < 4) neighbors.push((r - 1) * 5 + (c + 1));
    if (r < 4 && c > 0) neighbors.push((r + 1) * 5 + (c - 1));
    if (r < 4 && c < 4) neighbors.push((r + 1) * 5 + (c + 1));
  }

  return neighbors;
});

// Direction vectors
const ORTHOGONAL_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAGONAL_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/**
 * Creates the initial Baghchal board state.
 * 4 tigers placed at corners (0, 4, 20, 24), 20 goats in reserve.
 */
export function createInitialGameState(): GameState {
  const board: PieceType[] = Array(25).fill(null);
  board[0] = 'tiger';  // Top-left (0,0)
  board[4] = 'tiger';  // Top-right (0,4)
  board[20] = 'tiger'; // Bottom-left (4,0)
  board[24] = 'tiger'; // Bottom-right (4,4)

  return {
    board,
    turn: 'goat',
    goatsInReserve: 20,
    goatsCaptured: 0,
    phase: 'placement',
    status: 'playing',
    moveHistory: [],
    lastMove: null,
  };
}

/**
 * Gets all legal moves for a specific tiger at `pos`.
 */
export function getTigerMovesForPos(board: PieceType[], pos: number): Move[] {
  if (board[pos] !== 'tiger') return [];

  const moves: Move[] = [];
  const r = Math.floor(pos / 5);
  const c = pos % 5;

  // 1. Regular 1-step moves to adjacent empty spots
  for (const nextPos of ADJACENCY[pos]) {
    if (board[nextPos] === null) {
      moves.push({
        type: 'step',
        from: pos,
        to: nextPos,
        piece: 'tiger',
      });
    }
  }

  // 2. Jump captures over an adjacent goat into an empty spot
  const allowedDirs = (r + c) % 2 === 0 ? [...ORTHOGONAL_DIRS, ...DIAGONAL_DIRS] : ORTHOGONAL_DIRS;

  for (const [dr, dc] of allowedDirs) {
    const midR = r + dr;
    const midC = c + dc;
    const landR = r + 2 * dr;
    const landC = c + 2 * dc;

    // Check bounds for landing spot
    if (landR >= 0 && landR < 5 && landC >= 0 && landC < 5) {
      const midPos = midR * 5 + midC;
      const landPos = landR * 5 + landC;

      // Must jump over a goat into an empty spot
      if (board[midPos] === 'goat' && board[landPos] === null) {
        moves.push({
          type: 'jump',
          from: pos,
          to: landPos,
          captured: midPos,
          piece: 'tiger',
        });
      }
    }
  }

  return moves;
}

/**
 * Gets all legal moves for all tigers.
 */
export function getAllTigerMoves(board: PieceType[]): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < 25; i++) {
    if (board[i] === 'tiger') {
      moves.push(...getTigerMovesForPos(board, i));
    }
  }
  return moves;
}

/**
 * Gets all legal moves for goats depending on the current phase.
 */
export function getAllGoatMoves(board: PieceType[], goatsInReserve: number): Move[] {
  const moves: Move[] = [];

  // Placement Phase: Goat player places 1 goat on ANY empty spot
  if (goatsInReserve > 0) {
    for (let i = 0; i < 25; i++) {
      if (board[i] === null) {
        moves.push({
          type: 'place',
          to: i,
          piece: 'goat',
        });
      }
    }
    return moves;
  }

  // Movement Phase: Goat moves to an adjacent empty spot
  for (let i = 0; i < 25; i++) {
    if (board[i] === 'goat') {
      for (const nextPos of ADJACENCY[i]) {
        if (board[nextPos] === null) {
          moves.push({
            type: 'step',
            from: i,
            to: nextPos,
            piece: 'goat',
          });
        }
      }
    }
  }

  return moves;
}

/**
 * Count how many tigers are trapped (having 0 legal moves).
 */
export function getTrappedTigersInfo(board: PieceType[]): {
  trappedCount: number;
  trappedIndices: number[];
  freeCount: number;
} {
  const trappedIndices: number[] = [];
  let freeCount = 0;

  for (let i = 0; i < 25; i++) {
    if (board[i] === 'tiger') {
      const moves = getTigerMovesForPos(board, i);
      if (moves.length === 0) {
        trappedIndices.push(i);
      } else {
        freeCount++;
      }
    }
  }

  return {
    trappedCount: trappedIndices.length,
    trappedIndices,
    freeCount,
  };
}

/**
 * Applies a move to the game state and returns a new GameState.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const nextBoard = [...state.board];
  let nextReserve = state.goatsInReserve;
  let nextCaptured = state.goatsCaptured;

  if (move.piece === 'goat') {
    if (move.type === 'place') {
      nextBoard[move.to] = 'goat';
      nextReserve = Math.max(0, nextReserve - 1);
    } else if (move.type === 'step' && move.from !== undefined) {
      nextBoard[move.from] = null;
      nextBoard[move.to] = 'goat';
    }
  } else if (move.piece === 'tiger' && move.from !== undefined) {
    nextBoard[move.from] = null;
    nextBoard[move.to] = 'tiger';

    if (move.type === 'jump' && move.captured !== undefined) {
      nextBoard[move.captured] = null;
      nextCaptured += 1;
    }
  }

  const nextPhase: GamePhase = nextReserve === 0 ? 'movement' : 'placement';
  const nextTurn: PlayerRole = state.turn === 'goat' ? 'tiger' : 'goat';

  // Check victory condition
  let nextStatus: GameState['status'] = 'playing';

  if (nextCaptured >= 5) {
    nextStatus = 'tiger_won';
  } else {
    // Check if tigers are completely immobilized
    const { trappedCount } = getTrappedTigersInfo(nextBoard);
    if (trappedCount === 4) {
      nextStatus = 'goat_won';
    } else if (nextTurn === 'goat' && nextPhase === 'movement') {
      // Rare edge case: Goats have 0 legal moves
      const goatMoves = getAllGoatMoves(nextBoard, nextReserve);
      if (goatMoves.length === 0) {
        nextStatus = 'tiger_won';
      }
    }
  }

  return {
    board: nextBoard,
    turn: nextTurn,
    goatsInReserve: nextReserve,
    goatsCaptured: nextCaptured,
    phase: nextPhase,
    status: nextStatus,
    moveHistory: [...state.moveHistory, move],
    lastMove: move,
  };
}
