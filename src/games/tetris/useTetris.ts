import { useState, useCallback, useEffect, useRef } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT, TETROMINOS, TETROMINO_KEYS } from './constants';
import { Board, Piece, GameState } from './types';

const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const getRandomTetromino = (): string =>
  TETROMINO_KEYS[Math.floor(Math.random() * TETROMINO_KEYS.length)];

const createPiece = (type: string): Piece => ({
  shape: TETROMINOS[type].shape,
  color: TETROMINOS[type].color,
  position: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(TETROMINOS[type].shape[0].length / 2), y: 0 },
});

const rotate = (matrix: number[][]): number[][] => {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: number[][] = [];
  for (let i = 0; i < cols; i++) {
    rotated.push([]);
    for (let j = rows - 1; j >= 0; j--) {
      rotated[i].push(matrix[j][i]);
    }
  }
  return rotated;
};

interface UseTetrisProps {
  onLineClear?: (lineCount: number) => void;
}

export const useTetris = ({ onLineClear }: UseTetrisProps = {}) => {
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    currentPiece: null,
    nextPiece: getRandomTetromino(),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    isPaused: false,
    clearingLines: [],
  });
  
  const [showGhost, setShowGhost] = useState(true);
  const gameStateRef = useRef(gameState);
  const onLineClearRef = useRef(onLineClear);
  gameStateRef.current = gameState;
  onLineClearRef.current = onLineClear;

  const isValidMove = useCallback((piece: Piece, board: Board): boolean => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.position.x + x;
          const newY = piece.position.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) return false;
          if (newY >= 0 && board[newY][newX]) return false;
        }
      }
    }
    return true;
  }, []);

  const mergePieceToBoard = useCallback((piece: Piece, board: Board): Board => {
    const newBoard = board.map(row => [...row]);
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const boardY = piece.position.y + y;
          const boardX = piece.position.x + x;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = piece.color;
          }
        }
      }
    }
    return newBoard;
  }, []);

  const findCompleteLines = useCallback((board: Board): number[] => {
    const lines: number[] = [];
    board.forEach((row, index) => {
      if (row.every(cell => cell !== null)) {
        lines.push(index);
      }
    });
    return lines;
  }, []);

  const removeLines = useCallback((board: Board, lineIndices: number[]): Board => {
    const newBoard = board.filter((_, index) => !lineIndices.includes(index));
    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }
    return newBoard;
  }, []);

  const calculateScore = (linesCleared: number, level: number): number => {
    const points = [0, 100, 300, 500, 800];
    return points[linesCleared] * level;
  };

  const spawnPiece = useCallback(() => {
    setGameState(prev => {
      const newPiece = createPiece(prev.nextPiece);
      if (!isValidMove(newPiece, prev.board)) {
        return { ...prev, gameOver: true };
      }
      return {
        ...prev,
        currentPiece: newPiece,
        nextPiece: getRandomTetromino(),
      };
    });
  }, [isValidMove]);

  const lockPiece = useCallback((prev: GameState): GameState => {
    if (!prev.currentPiece) return prev;
    
    const mergedBoard = mergePieceToBoard(prev.currentPiece, prev.board);
    const completeLines = findCompleteLines(mergedBoard);
    
    if (completeLines.length > 0) {
      // Trigger sound effect
      if (onLineClearRef.current) {
        onLineClearRef.current(completeLines.length);
      }
      
      // Start clearing animation
      return {
        ...prev,
        board: mergedBoard,
        currentPiece: null,
        clearingLines: completeLines,
      };
    }
    
    // No lines to clear
    return {
      ...prev,
      board: mergedBoard,
      currentPiece: null,
    };
  }, [mergePieceToBoard, findCompleteLines]);

  // Handle clearing animation completion
  useEffect(() => {
    if (gameState.clearingLines.length > 0) {
      const timer = setTimeout(() => {
        setGameState(prev => {
          const newBoard = removeLines(prev.board, prev.clearingLines);
          const linesCleared = prev.clearingLines.length;
          const newScore = prev.score + calculateScore(linesCleared, prev.level);
          const newLines = prev.lines + linesCleared;
          const newLevel = Math.floor(newLines / 10) + 1;
          
          return {
            ...prev,
            board: newBoard,
            clearingLines: [],
            score: newScore,
            lines: newLines,
            level: newLevel,
          };
        });
      }, 300); // Animation duration
      
      return () => clearTimeout(timer);
    }
  }, [gameState.clearingLines, removeLines]);

  const movePiece = useCallback((dx: number, dy: number) => {
    setGameState(prev => {
      if (!prev.currentPiece || prev.gameOver || prev.isPaused || prev.clearingLines.length > 0) return prev;
      const newPiece: Piece = {
        ...prev.currentPiece,
        position: {
          x: prev.currentPiece.position.x + dx,
          y: prev.currentPiece.position.y + dy,
        },
      };
      if (isValidMove(newPiece, prev.board)) {
        return { ...prev, currentPiece: newPiece };
      }
      if (dy > 0) {
        return lockPiece(prev);
      }
      return prev;
    });
  }, [isValidMove, lockPiece]);

  const rotatePiece = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentPiece || prev.gameOver || prev.isPaused || prev.clearingLines.length > 0) return prev;
      const rotatedShape = rotate(prev.currentPiece.shape);
      const newPiece: Piece = { ...prev.currentPiece, shape: rotatedShape };
      if (isValidMove(newPiece, prev.board)) {
        return { ...prev, currentPiece: newPiece };
      }
      for (const kick of [-1, 1, -2, 2]) {
        const kickedPiece: Piece = {
          ...newPiece,
          position: { ...newPiece.position, x: newPiece.position.x + kick },
        };
        if (isValidMove(kickedPiece, prev.board)) {
          return { ...prev, currentPiece: kickedPiece };
        }
      }
      return prev;
    });
  }, [isValidMove]);

  const getGhostPosition = useCallback((piece: Piece, board: Board): number => {
    let ghostY = piece.position.y;
    while (isValidMove({ ...piece, position: { ...piece.position, y: ghostY + 1 } }, board)) {
      ghostY++;
    }
    return ghostY;
  }, [isValidMove]);

  const hardDrop = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentPiece || prev.gameOver || prev.isPaused || prev.clearingLines.length > 0) return prev;
      const ghostY = getGhostPosition(prev.currentPiece, prev.board);
      const dropDistance = ghostY - prev.currentPiece.position.y;
      const droppedPiece: Piece = { 
        ...prev.currentPiece, 
        position: { ...prev.currentPiece.position, y: ghostY } 
      };
      
      const mergedBoard = mergePieceToBoard(droppedPiece, prev.board);
      const completeLines = findCompleteLines(mergedBoard);
      
      if (completeLines.length > 0) {
        if (onLineClearRef.current) {
          onLineClearRef.current(completeLines.length);
        }
        
        return {
          ...prev,
          board: mergedBoard,
          currentPiece: null,
          clearingLines: completeLines,
          score: prev.score + dropDistance * 2,
        };
      }
      
      return {
        ...prev,
        board: mergedBoard,
        currentPiece: null,
        score: prev.score + dropDistance * 2,
      };
    });
  }, [getGhostPosition, mergePieceToBoard, findCompleteLines]);

  const togglePause = useCallback(() => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);
  
  const toggleGhost = useCallback(() => {
    setShowGhost(prev => !prev);
  }, []);

  const resetGame = useCallback(() => {
    setGameState({
      board: createEmptyBoard(),
      currentPiece: null,
      nextPiece: getRandomTetromino(),
      score: 0,
      lines: 0,
      level: 1,
      gameOver: false,
      isPaused: false,
      clearingLines: [],
    });
  }, []);

  // Spawn piece when needed
  useEffect(() => {
    if (!gameState.currentPiece && !gameState.gameOver && gameState.clearingLines.length === 0) {
      spawnPiece();
    }
  }, [gameState.currentPiece, gameState.gameOver, gameState.clearingLines, spawnPiece]);

  // Game loop
  useEffect(() => {
    if (gameState.gameOver || gameState.isPaused || gameState.clearingLines.length > 0) return;
    
    const speed = Math.max(100, 1000 - (gameState.level - 1) * 100);
    
    const tick = () => {
      const current = gameStateRef.current;
      if (current.currentPiece && !current.gameOver && !current.isPaused && current.clearingLines.length === 0) {
        movePiece(0, 1);
      }
    };
    
    const interval = setInterval(tick, speed);
    return () => clearInterval(interval);
  }, [gameState.gameOver, gameState.isPaused, gameState.level, gameState.clearingLines, movePiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.gameOver) {
        if (e.key === 'Enter') resetGame();
        return;
      }
      if (gameState.clearingLines.length > 0) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotatePiece();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePause();
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          toggleGhost();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.gameOver, gameState.clearingLines, movePiece, rotatePiece, hardDrop, togglePause, toggleGhost, resetGame]);

  const ghostY = gameState.currentPiece && showGhost
    ? getGhostPosition(gameState.currentPiece, gameState.board)
    : null;

  return {
    gameState,
    ghostY,
    showGhost,
    movePiece,
    rotatePiece,
    hardDrop,
    togglePause,
    toggleGhost,
    resetGame,
  };
};
