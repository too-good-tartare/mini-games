export type Grid = (number | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Tile {
  id: number;
  value: number;
  position: Position;
  mergedFrom?: [Tile, Tile];
  isNew?: boolean;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GameState {
  grid: Grid;
  tiles: Tile[];
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  canContinue: boolean;
  previousState: { grid: Grid; tiles: Tile[]; score: number } | null;
}
