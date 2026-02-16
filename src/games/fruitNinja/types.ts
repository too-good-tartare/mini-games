export interface FruitType {
  emoji: string;
  name: string;
  color: string;
  points?: number;
}

export interface Fruit {
  id: number;
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  sliced: boolean;
  isBomb: boolean;
}

export interface SlicedHalf {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  side: 'left' | 'right';
}

export interface SliceTrail {
  x: number;
  y: number;
  age: number;
}

export interface GameState {
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  isPlaying: boolean;
  isGameOver: boolean;
  bestScore: number;
}
