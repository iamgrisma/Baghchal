import { Move, PlayerRole } from '../types';

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
 * Systematic Tiger Identifiers and their home corners
 */
export const TIGER_IDS = ['A', 'B', 'C', 'D'] as const;
export type TigerId = typeof TIGER_IDS[number];

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
 * Computes native SHA-256 cryptographic hash using browser Web Crypto
 */
export async function calculateBlockHash(data: Omit<LedgerBlock, 'hash'>): Promise<string> {
  const serialized = `${data.index}|${data.prevHash}|${data.timestamp}|${data.actor}|${data.pieceId}|${data.action}|${data.from || ''}|${data.to}|${data.capturedGoatId || ''}`;
  const msgBuffer = new TextEncoder().encode(serialized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
    capturedPos?: number
  ): Promise<LedgerBlock> {
    const nextIndex = this.chain.length;
    const prevHash = this.getLatestHash();
    const timestamp = Date.now();

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
        fromChar = POS_TO_CHAR[move.from!];
        for (const [id, pos] of this.pieceMap.entries()) {
          if (id.startsWith('G') && pos === fromChar) {
            pieceId = id;
            break;
          }
        }
      }
    } else {
      // Tiger action
      fromChar = POS_TO_CHAR[move.from!];
      for (const [id, pos] of this.pieceMap.entries()) {
        if (TIGER_IDS.includes(id as TigerId) && pos === fromChar) {
          pieceId = id;
          break;
        }
      }

      if (move.type === 'jump') {
        action = 'JUMP';
        if (capturedPos !== undefined) {
          const capChar = POS_TO_CHAR[capturedPos];
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
   * Verifies block cryptographic integrity and appends to the chain
   */
  public async verifyAndAppendBlock(block: LedgerBlock): Promise<boolean> {
    const expectedIndex = this.chain.length;
    const expectedPrevHash = this.getLatestHash();

    // 1. Verify chain continuity
    if (block.index !== expectedIndex || block.prevHash !== expectedPrevHash) {
      console.warn('Block rejected: Broken link in chain', { block, expectedIndex, expectedPrevHash });
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
}
