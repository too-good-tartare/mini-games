import { useState, useCallback, useEffect } from 'react';
import { GRID_SIZE, WIN_VALUE, STORAGE_KEY } from './constants';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
  prevRow?: number;
  prevCol?: number;
}

interface GameState {
  tiles: Tile[];
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  keepPlaying: boolean;
  prevTiles: Tile[] | null;
  prevScore: number;
}

const getOccupiedCells = (tiles: Tile[]): Set<string> => {
  const set = new Set<string>();
  tiles.forEach(t => set.add(`${t.row},${t.col}`));
  return set;
};

const getEmptyCells = (tiles: Tile[]): [number, number][] => {
  const occupied = getOccupiedCells(tiles);
  const empty: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!occupied.has(`${r},${c}`)) empty.push([r, c]);
    }
  }
  return empty;
};

let nextTileId = 1;
const createTile = (row: number, col: number, value: number, isNew = false): Tile => ({
  id: nextTileId++,
  value,
  row,
  col,
  isNew,
  isMerged: false,
});

const addRandomTile = (tiles: Tile[]): { tiles: Tile[]; newTile: Tile | null } => {
  const empty = getEmptyCells(tiles);
  if (empty.length === 0) return { tiles, newTile: null };
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newTile = createTile(r, c, Math.random() < 0.9 ? 2 : 4, true);
  return { tiles: [...tiles, newTile], newTile };
};

type Direction = 'left' | 'right' | 'up' | 'down';

const moveTiles = (tiles: Tile[], direction: Direction): { tiles: Tile[]; score: number; moved: boolean } => {
  // Clear animation flags and store previous positions
  let newTiles = tiles.map(t => ({ 
    ...t, 
    isNew: false, 
    isMerged: false,
    prevRow: t.row,
    prevCol: t.col
  }));
  
  let score = 0;
  let moved = false;
  
  // Determine sort order and movement axis
  const isHorizontal = direction === 'left' || direction === 'right';
  const isReverse = direction === 'right' || direction === 'down';
  
  // Group tiles by row (horizontal) or column (vertical)
  const groups: Map<number, Tile[]> = new Map();
  newTiles.forEach(tile => {
    const key = isHorizontal ? tile.row : tile.col;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tile);
  });
  
  const resultTiles: Tile[] = [];
  const tilesToRemove = new Set<number>();
  
  groups.forEach((groupTiles, lineIndex) => {
    // Sort tiles in the line
    groupTiles.sort((a, b) => {
      const aPos = isHorizontal ? a.col : a.row;
      const bPos = isHorizontal ? b.col : b.row;
      return isReverse ? bPos - aPos : aPos - bPos;
    });
    
    let targetPos = isReverse ? GRID_SIZE - 1 : 0;
    const step = isReverse ? -1 : 1;
    
    for (let i = 0; i < groupTiles.length; i++) {
      const tile = groupTiles[i];
      const nextTile = groupTiles[i + 1];
      
      // Check for merge
      if (nextTile && tile.value === nextTile.value && !tilesToRemove.has(tile.id)) {
        // Merge: tile absorbs nextTile
        const newValue = tile.value * 2;
        score += newValue;
        
        // Update tile position and value
        if (isHorizontal) {
          if (tile.col !== targetPos) moved = true;
          tile.col = targetPos;
        } else {
          if (tile.row !== targetPos) moved = true;
          tile.row = targetPos;
        }
        tile.value = newValue;
        tile.isMerged = true;
        
        // Move nextTile to same position (for animation) then mark for removal
        if (isHorizontal) {
          nextTile.col = targetPos;
        } else {
          nextTile.row = targetPos;
        }
        tilesToRemove.add(nextTile.id);
        moved = true;
        
        resultTiles.push(tile);
        i++; // Skip next tile
        targetPos += step;
      } else if (!tilesToRemove.has(tile.id)) {
        // Just move
        const oldPos = isHorizontal ? tile.col : tile.row;
        if (isHorizontal) {
          tile.col = targetPos;
        } else {
          tile.row = targetPos;
        }
        if (oldPos !== targetPos) moved = true;
        resultTiles.push(tile);
        targetPos += step;
      }
    }
  });
  
  return { 
    tiles: resultTiles.filter(t => !tilesToRemove.has(t.id)), 
    score, 
    moved 
  };
};

const canMove = (tiles: Tile[]): boolean => {
  if (getEmptyCells(tiles).length > 0) return true;
  
  // Check for possible merges
  const grid: (number | null)[][] = Array.from({ length: GRID_SIZE }, () => 
    Array(GRID_SIZE).fill(null)
  );
  tiles.forEach(t => { grid[t.row][t.col] = t.value; });
  
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = grid[r][c];
      if (val === null) continue;
      if ((c < GRID_SIZE - 1 && grid[r][c + 1] === val) || 
          (r < GRID_SIZE - 1 && grid[r + 1][c] === val)) {
        return true;
      }
    }
  }
  return false;
};

const hasWon = (tiles: Tile[]): boolean => tiles.some(t => t.value === WIN_VALUE);

interface Use2048Props {
  onMove?: () => void;
  onMerge?: (value: number) => void;
  onWin?: () => void;
  onGameOver?: () => void;
}

const initGame = (): { tiles: Tile[]; bestScore: number } => {
  const bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  let tiles: Tile[] = [];
  const first = addRandomTile(tiles);
  const second = addRandomTile(first.tiles);
  return { tiles: second.tiles, bestScore };
};

export const use2048 = ({ onMove, onMerge, onWin, onGameOver }: Use2048Props = {}) => {
  const [state, setState] = useState<GameState>(() => {
    const { tiles, bestScore } = initGame();
    return { 
      tiles, 
      score: 0, 
      bestScore, 
      gameOver: false, 
      won: false, 
      keepPlaying: false, 
      prevTiles: null, 
      prevScore: 0 
    };
  });

  const handleMove = useCallback((direction: Direction) => {
    setState(prev => {
      if (prev.gameOver || (prev.won && !prev.keepPlaying)) return prev;
      
      const { tiles: movedTiles, score: addedScore, moved } = moveTiles(prev.tiles, direction);
      if (!moved) return prev;
      
      onMove?.();
      if (addedScore > 0) onMerge?.(addedScore);
      
      const { tiles: tilesWithNew } = addRandomTile(movedTiles);
      const newScore = prev.score + addedScore;
      const newBest = Math.max(newScore, prev.bestScore);
      
      if (newBest > prev.bestScore) {
        localStorage.setItem(STORAGE_KEY, String(newBest));
      }
      
      const won = !prev.won && hasWon(tilesWithNew);
      if (won) onWin?.();
      
      const gameOver = !canMove(tilesWithNew);
      if (gameOver) onGameOver?.();
      
      return { 
        ...prev, 
        tiles: tilesWithNew, 
        score: newScore, 
        bestScore: newBest, 
        won: prev.won || won, 
        gameOver, 
        prevTiles: prev.tiles, 
        prevScore: prev.score 
      };
    });
  }, [onMove, onMerge, onWin, onGameOver]);

  const undo = useCallback(() => {
    setState(prev => {
      if (!prev.prevTiles) return prev;
      return { 
        ...prev, 
        tiles: prev.prevTiles, 
        score: prev.prevScore, 
        prevTiles: null, 
        gameOver: false 
      };
    });
  }, []);

  const reset = useCallback(() => {
    nextTileId = 1;
    const { tiles } = initGame();
    setState(prev => ({ 
      ...prev, 
      tiles, 
      score: 0, 
      gameOver: false, 
      won: false, 
      keepPlaying: false, 
      prevTiles: null, 
      prevScore: 0 
    }));
  }, []);

  const continuePlaying = useCallback(() => {
    setState(prev => ({ ...prev, keepPlaying: true }));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const keyMap: Record<string, Direction> = { 
      ArrowUp: 'up', 
      ArrowDown: 'down', 
      ArrowLeft: 'left', 
      ArrowRight: 'right' 
    };
    const handleKey = (e: KeyboardEvent) => {
      const dir = keyMap[e.key];
      if (dir) { 
        e.preventDefault(); 
        handleMove(dir); 
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleMove]);

  return { 
    ...state, 
    handleMove, 
    undo, 
    reset, 
    continuePlaying, 
    canUndo: !!state.prevTiles 
  };
};
