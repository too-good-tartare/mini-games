import { useState, useCallback, useEffect } from 'react';
import { GRID_SIZE, WIN_VALUE, STORAGE_KEY } from './constants';

type Grid = (number | null)[][];

interface GameState {
  grid: Grid;
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  keepPlaying: boolean;
  prevGrid: Grid | null;
  prevScore: number;
  newTilePos: [number, number] | null;
  mergedPositions: [number, number][];
}

const createEmptyGrid = (): Grid =>
  Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

const getEmptyCells = (grid: Grid): [number, number][] => {
  const empty: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((cell, c) => { if (!cell) empty.push([r, c]); }));
  return empty;
};

const addRandomTile = (grid: Grid): { grid: Grid; pos: [number, number] | null } => {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return { grid, pos: null };
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return { grid: newGrid, pos: [r, c] };
};

const rotateGrid = (grid: Grid): Grid => {
  const n = GRID_SIZE;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => grid[n - 1 - j][i]));
};

const slideLeft = (grid: Grid): { grid: Grid; score: number; moved: boolean; mergedCols: number[][] } => {
  let score = 0;
  let moved = false;
  const mergedCols: number[][] = [];
  const newGrid = grid.map((row, rowIdx) => {
    const filtered = row.filter(x => x !== null) as number[];
    const merged: number[] = [];
    const rowMergedCols: number[] = [];
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const val = filtered[i] * 2;
        merged.push(val);
        rowMergedCols.push(merged.length - 1);
        score += val;
        i += 2;
      } else {
        merged.push(filtered[i]);
        i++;
      }
    }
    while (merged.length < GRID_SIZE) merged.push(null as any);
    if (JSON.stringify(merged) !== JSON.stringify(row)) moved = true;
    mergedCols.push(rowMergedCols);
    return merged;
  });
  return { grid: newGrid, score, moved, mergedCols };
};

const transformMergedPositions = (mergedCols: number[][], rot: number): [number, number][] => {
  const positions: [number, number][] = [];
  mergedCols.forEach((cols, row) => {
    cols.forEach(col => {
      let r = row, c = col;
      // Reverse the rotation to get original position
      for (let i = 0; i < (4 - rot) % 4; i++) {
        const newR = c;
        const newC = GRID_SIZE - 1 - r;
        r = newR;
        c = newC;
      }
      positions.push([r, c]);
    });
  });
  return positions;
};

const move = (grid: Grid, direction: string): { grid: Grid; score: number; moved: boolean; mergedPositions: [number, number][] } => {
  let g = grid;
  const rotations: Record<string, number> = { left: 0, up: 1, right: 2, down: 3 };
  const rot = rotations[direction];
  for (let i = 0; i < rot; i++) g = rotateGrid(g);
  const result = slideLeft(g);
  for (let i = 0; i < (4 - rot) % 4; i++) result.grid = rotateGrid(result.grid);
  const mergedPositions = transformMergedPositions(result.mergedCols, rot);
  return { grid: result.grid, score: result.score, moved: result.moved, mergedPositions };
};

const canMove = (grid: Grid): boolean => {
  if (getEmptyCells(grid).length > 0) return true;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = grid[r][c];
      if ((c < GRID_SIZE - 1 && grid[r][c + 1] === val) || (r < GRID_SIZE - 1 && grid[r + 1][c] === val)) return true;
    }
  }
  return false;
};

const hasWon = (grid: Grid): boolean => grid.some(row => row.some(cell => cell === WIN_VALUE));

interface Use2048Props {
  onMove?: () => void;
  onMerge?: (value: number) => void;
  onWin?: () => void;
  onGameOver?: () => void;
}

export const use2048 = ({ onMove, onMerge, onWin, onGameOver }: Use2048Props = {}) => {
  const [state, setState] = useState<GameState>(() => {
    const bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    let grid = createEmptyGrid();
    const first = addRandomTile(grid);
    const second = addRandomTile(first.grid);
    return { grid: second.grid, score: 0, bestScore, gameOver: false, won: false, keepPlaying: false, prevGrid: null, prevScore: 0, newTilePos: second.pos, mergedPositions: [] };
  });

  const handleMove = useCallback((direction: string) => {
    setState(prev => {
      if (prev.gameOver || (prev.won && !prev.keepPlaying)) return prev;
      const { grid: newGrid, score: addedScore, moved, mergedPositions } = move(prev.grid, direction);
      if (!moved) return prev;
      
      onMove?.();
      if (addedScore > 0) onMerge?.(addedScore);
      
      const { grid: gridWithNew, pos: newTilePos } = addRandomTile(newGrid);
      const newScore = prev.score + addedScore;
      const newBest = Math.max(newScore, prev.bestScore);
      
      if (newBest > prev.bestScore) localStorage.setItem(STORAGE_KEY, String(newBest));
      
      const won = !prev.won && hasWon(gridWithNew);
      if (won) onWin?.();
      
      const gameOver = !canMove(gridWithNew);
      if (gameOver) onGameOver?.();
      
      return { ...prev, grid: gridWithNew, score: newScore, bestScore: newBest, won: prev.won || won, gameOver, prevGrid: prev.grid, prevScore: prev.score, newTilePos, mergedPositions };
    });
  }, [onMove, onMerge, onWin, onGameOver]);

  const undo = useCallback(() => {
    setState(prev => prev.prevGrid ? { ...prev, grid: prev.prevGrid, score: prev.prevScore, prevGrid: null, gameOver: false } : prev);
  }, []);

  const reset = useCallback(() => {
    let grid = createEmptyGrid();
    const first = addRandomTile(grid);
    const second = addRandomTile(first.grid);
    setState(prev => ({ ...prev, grid: second.grid, score: 0, gameOver: false, won: false, keepPlaying: false, prevGrid: null, prevScore: 0, newTilePos: second.pos, mergedPositions: [] }));
  }, []);

  const continuePlaying = useCallback(() => {
    setState(prev => ({ ...prev, keepPlaying: true }));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const keyMap: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const handleKey = (e: KeyboardEvent) => {
      if (keyMap[e.key]) { e.preventDefault(); handleMove(keyMap[e.key]); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleMove]);

  return { ...state, handleMove, undo, reset, continuePlaying, canUndo: !!state.prevGrid };
};
