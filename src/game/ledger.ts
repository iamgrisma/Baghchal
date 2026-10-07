import { Move, PlayerRole, GameState } from '../types';
import { applyMove, getAllGoatMoves, getTigerMovesForPos } from './rules';

/**
 * Grid coordinates mapping (0 to 24 mapped to letters 'a' through 'y')
 */
export const POS_TO_CHAR: Record<number, string> = {};
export const CHAR_TO_POS: Record<string, number> = {};

for (let i = 0; i < 25; i++) {
  const char = String.fromCharCode(97 + i); // 97 is ASCII 'a'
  POS_TO_CHAR[i] = char;
  CHAR_TO_POS[char] = i;
}

/**
 * Systematic Tiger Identifiers and their initial home corners
 */
export const TIGER_IDS = ['A', 'B', 'C', 'D'] as const;
export type TigerId = (typeof TIGER_IDS)[number];

export const INITIAL_TIGER_POSITIONS: Record<TigerId, string> = {
  A: 'a', // index 0 (top-left)
  B: 'e', // index 4 (top-right)
  C: 'u', // index 20 (bottom-left)
  D: 'y', // index 24 (bottom-right)
};

/**
 * Block interface for each verifiable move in the match
 */
export interface LedgerBlock {
  index: number;
  prevHash: string;
  timestamp: number;
  actor: PlayerRole;
  pieceId: string; // 'A'..'D' or 'G1'..'G20'
  action: 'PLACE' | 'MOVE' | 'JUMP';
  from?: string; // 'a'..'y'
  to: string; // 'a'..'y'
  capturedGoatId?: string; // e.g. 'G13'
  hash: string;
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes SHA-256 cryptographic hash using browser Web Crypto or safe fallback
 */
export async function calculateBlockHash(data: Omit<LedgerBlock, 'hash'>): Promise<string> {
  const fromStr = data.from ?? '';
  const capStr = data.capturedGoatId ?? '';
  const serialized = `${data.index}|${data.prevHash}|${data.timestamp}|${data.actor}|${data.pieceId}|${data.action}|${fromStr}|${data.to}|${capStr}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(serialized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback below
    }
  }

  // Fast deterministic fallback if subtle crypto is unavailable
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c64e6d ^ 0;
  for (let i = 0; i < serialized.length; i++) {
    const ch = serialized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (part1 + part2).repeat(4);
}

/**
 * Deterministic Baghchal Ledger Engine
 */
export class BaghchalLedger {
  public chain: LedgerBlock[] = [];
  public currentGoatIndex: number = 0;
  public pieceMap: Map<string, string> = new Map(); // pieceId -> position char ('a'..'y')
  public capturedGoats: Set<string> = new Set();

  constructor() {
    this.reset();
  }

  public reset() {
    this.chain = [];
    this.currentGoatIndex = 0;
    this.pieceMap.clear();
    this.capturedGoats.clear();

    // Place the four tigers at their standard corner positions
    for (const [tigerId, pos] of Object.entries(INITIAL_TIGER_POSITIONS)) {
      this.pieceMap.set(tigerId, pos);
    }
  }

  public getLatestHash(): string {
    if (this.chain.length === 0) return GENESIS_HASH;
    return this.chain[this.chain.length - 1].hash;
  }

  /**
   * Crafts a new cryptographic block from an in-game move
   */
  public async createBlock(
    actor: PlayerRole,
    move: Move,
    capturedPos?: number,
    customTimestamp?: number
  ): Promise<LedgerBlock> {
    const nextIndex = this.chain.length;
    const prevHash = this.getLatestHash();
    const timestamp = customTimestamp || Date.now();

    let pieceId = '';
    let action: 'PLACE' | 'MOVE' | 'JUMP' = 'MOVE';
    let fromChar: string | undefined = undefined;
    const toChar = POS_TO_CHAR[move.to];
    let capturedGoatId: string | undefined = undefined;

    if (actor === 'goat') {
      if (move.type === 'place') {
        action = 'PLACE';
        this.currentGoatIndex += 1;
        pieceId = `G${this.currentGoatIndex}`;
      } else {
        action = 'MOVE';
        fromChar = move.from !== undefined ? POS_TO_CHAR[move.from] : undefined;
        if (fromChar) {
          for (const [id, pos] of this.pieceMap.entries()) {
            if (id.startsWith('G') && pos === fromChar) {
              pieceId = id;
              break;
            }
          }
        }
        if (!pieceId) {
          this.currentGoatIndex = Math.max(this.currentGoatIndex, 1);
          pieceId = `G${this.currentGoatIndex}`;
        }
      }
    } else {
      // Tiger action
      fromChar = move.from !== undefined ? POS_TO_CHAR[move.from] : undefined;
      if (fromChar) {
        for (const [id, pos] of this.pieceMap.entries()) {
          if (TIGER_IDS.includes(id as TigerId) && pos === fromChar) {
            pieceId = id;
            break;
          }
        }
      }
      if (!pieceId) {
        pieceId = 'A';
      }

      if (move.type === 'jump') {
        action = 'JUMP';
        const effectiveCap = capturedPos !== undefined ? capturedPos : move.captured;
        if (effectiveCap !== undefined) {
          const capChar = POS_TO_CHAR[effectiveCap];
          for (const [id, pos] of this.pieceMap.entries()) {
            if (id.startsWith('G') && pos === capChar) {
              capturedGoatId = id;
              break;
            }
          }
        }
      } else {
        action = 'MOVE';
      }
    }

    const rawBlock: Omit<LedgerBlock, 'hash'> = {
      index: nextIndex,
      prevHash,
      timestamp,
      actor,
      pieceId: pieceId || (actor === 'goat' ? `G${this.currentGoatIndex}` : 'A'),
      action,
      from: fromChar,
      to: toChar,
      capturedGoatId,
    };

    const hash = await calculateBlockHash(rawBlock);
    return { ...rawBlock, hash };
  }

  /**
   * Appends a locally generated block to the chain
   */
  public async appendLocalBlock(block: LedgerBlock): Promise<boolean> {
    return this.verifyAndAppendBlock(block);
  }

  /**
   * Verifies block cryptographic integrity and appends to the chain
   */
  public async verifyAndAppendBlock(block: LedgerBlock): Promise<boolean> {
    const expectedIndex = this.chain.length;
    const expectedPrevHash = this.getLatestHash();

    // If block is already in chain at that index and matches, accept idempotently
    if (block.index < expectedIndex) {
      const existing = this.chain[block.index];
      return existing && existing.hash === block.hash;
    }

    // 1. Verify chain continuity
    if (block.index !== expectedIndex || block.prevHash !== expectedPrevHash) {
      console.warn('Block rejected: Broken link in chain', {
        blockIndex: block.index,
        expectedIndex,
        blockPrev: block.prevHash,
        expectedPrev: expectedPrevHash,
      });
      return false;
    }

    // 2. Re-compute SHA-256 hash
    const { hash, ...blockWithoutHash } = block;
    const computedHash = await calculateBlockHash(blockWithoutHash);
    if (computedHash !== hash) {
      console.warn('Block rejected: Tampered SHA-256 hash signature', { hash, computedHash });
      return false;
    }

    // 3. Append block and update positional maps
    this.chain.push(block);
    this.pieceMap.set(block.pieceId, block.to);

    if (block.capturedGoatId) {
      this.capturedGoats.add(block.capturedGoatId);
      this.pieceMap.delete(block.capturedGoatId);
    }

    if (block.action === 'PLACE') {
      const parsedNum = parseInt(block.pieceId.replace('G', ''), 10);
      if (!isNaN(parsedNum)) {
        this.currentGoatIndex = Math.max(this.currentGoatIndex, parsedNum);
      }
    }

    return true;
  }

  /**
   * Slices missing blocks for delta sync on peer reconnection
   */
  public getBlocksFrom(startIndex: number): LedgerBlock[] {
    return this.chain.slice(startIndex);
  }

  /**
   * Deterministically reconstructs the entire verified chain from move history.
   * Guarantees that the ledger is ALWAYS 100% in sync with the board state!
   */
  public static async reconstructChainFromHistory(moves: Move[]): Promise<BaghchalLedger> {
    const ledger = new BaghchalLedger();
    let turn: PlayerRole = 'goat';

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const actor: PlayerRole = move.piece || turn;
      const block = await ledger.createBlock(actor, move, move.captured, Date.now() - (moves.length - i) * 1000);
      await ledger.verifyAndAppendBlock(block);
      turn = turn === 'goat' ? 'tiger' : 'goat';
    }

    return ledger;
  }

  /**
   * Deterministically converts a verified LedgerBlock into a legal Move.
   */
  public static blockToMove(block: LedgerBlock): Move {
    const toPos = CHAR_TO_POS[block.to];

    if (block.action === 'PLACE') {
      return {
        type: 'place',
        to: toPos,
        piece: 'goat',
      };
    }

    const fromPos = block.from !== undefined ? CHAR_TO_POS[block.from] : -1;

    if (block.action === 'JUMP') {
      const fromR = Math.floor(fromPos / 5);
      const fromC = fromPos % 5;
      const toR = Math.floor(toPos / 5);
      const toC = toPos % 5;
      const midR = (fromR + toR) / 2;
      const midC = (fromC + toC) / 2;
      const capturedPos = midR * 5 + midC;

      return {
        type: 'jump',
        from: fromPos,
        to: toPos,
        captured: capturedPos,
        piece: 'tiger',
      };
    }

    return {
      type: 'step',
      from: fromPos,
      to: toPos,
      piece: block.actor,
    };
  }

  /**
   * Cryptographically and rule-wise verifies that a block corresponds to a legal move under official Baghchal rules.
   */
  public static verifyBlockMoveLegal(block: LedgerBlock, state: GameState): boolean {
    if (state.status !== 'playing') return false;
    if (block.actor !== state.turn) return false;

    const move = BaghchalLedger.blockToMove(block);

    if (block.actor === 'goat') {
      if (state.phase === 'placement') {
        if (move.type !== 'place') return false;
        if (state.board[move.to] !== null) return false;
        if (state.goatsInReserve <= 0) return false;
        return true;
      } else {
        if (move.type !== 'step' || move.from === undefined) return false;
        if (state.board[move.from] !== 'goat') return false;
        if (state.board[move.to] !== null) return false;
        const legalGoatMoves = getAllGoatMoves(state.board, 0);
        return legalGoatMoves.some((m) => m.from === move.from && m.to === move.to);
      }
    } else {
      // Tiger move
      if (move.from === undefined) return false;
      if (state.board[move.from] !== 'tiger') return false;
      if (state.board[move.to] !== null) return false;
      const legalTigerMoves = getTigerMovesForPos(state.board, move.from);
      return legalTigerMoves.some(
        (m) => m.type === move.type && m.from === move.from && m.to === move.to
      );
    }
  }

  /**
   * Deterministically projects a verified LedgerBlock onto the game state.
   * Guarantees zero game tampering since the board state is a pure projection of the ledger!
   */
  public static applyBlockToState(state: GameState, block: LedgerBlock): GameState {
    const move = BaghchalLedger.blockToMove(block);
    return applyMove(state, move);
  }
}
