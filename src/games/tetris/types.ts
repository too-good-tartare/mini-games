export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  shape: number[][];
  color: string;
  position: Position;
}

export type Board = (string | null)[][];

export interface GameState {
  board: Board;
  currentPiece: Piece | null;
  nextPiece: string;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  isPaused: boolean;
  clearingLines: number[]; // Row indices being cleared
}
