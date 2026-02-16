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

export const useTetris = () => {
  const [gameState, setGameState] = useState<GameState>({
    board: createEmptyBoard(),
    currentPiece: null,
    nextPiece: getRandomTetromino(),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    isPaused: false,
  });
  
  const [showGhost, setShowGhost] = useState(true);
  
  // Use ref to avoid resetting the game loop on every state change
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

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

  const clearLines = useCallback((board: Board): { newBoard: Board; linesCleared: number } => {
    let linesCleared = 0;
    const newBoard = board.filter(row => {
      if (row.every(cell => cell !== null)) {
        linesCleared++;
        return false;
      }
      return true;
    });
    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }
    return { newBoard, linesCleared };
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
    const { newBoard, linesCleared } = clearLines(mergedBoard);
    const newScore = prev.score + calculateScore(linesCleared, prev.level);
    const newLines = prev.lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    return {
      ...prev,
      board: newBoard,
      currentPiece: null,
      score: newScore,
      lines: newLines,
      level: newLevel,
    };
  }, [mergePieceToBoard, clearLines]);

  const movePiece = useCallback((dx: number, dy: number) => {
    setGameState(prev => {
      if (!prev.currentPiece || prev.gameOver || prev.isPaused) return prev;
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
      if (!prev.currentPiece || prev.gameOver || prev.isPaused) return prev;
      const rotatedShape = rotate(prev.currentPiece.shape);
      const newPiece: Piece = { ...prev.currentPiece, shape: rotatedShape };
      if (isValidMove(newPiece, prev.board)) {
        return { ...prev, currentPiece: newPiece };
      }
      // Wall kick attempts
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
      if (!prev.currentPiece || prev.gameOver || prev.isPaused) return prev;
      const ghostY = getGhostPosition(prev.currentPiece, prev.board);
      const dropDistance = ghostY - prev.currentPiece.position.y;
      const droppedPiece: Piece = { 
        ...prev.currentPiece, 
        position: { ...prev.currentPiece.position, y: ghostY } 
      };
      const mergedBoard = mergePieceToBoard(droppedPiece, prev.board);
      const { newBoard, linesCleared } = clearLines(mergedBoard);
      const newScore = prev.score + calculateScore(linesCleared, prev.level) + dropDistance * 2;
      const newLines = prev.lines + linesCleared;
      const newLevel = Math.floor(newLines / 10) + 1;
      return {
        ...prev,
        board: newBoard,
        currentPiece: null,
        score: newScore,
        lines: newLines,
        level: newLevel,
      };
    });
  }, [getGhostPosition, mergePieceToBoard, clearLines]);

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
    });
  }, []);

  // Spawn piece when needed
  useEffect(() => {
    if (!gameState.currentPiece && !gameState.gameOver) {
      spawnPiece();
    }
  }, [gameState.currentPiece, gameState.gameOver, spawnPiece]);

  // Game loop - using ref to prevent reset on piece changes
  useEffect(() => {
    if (gameState.gameOver || gameState.isPaused) return;
    
    const speed = Math.max(100, 1000 - (gameState.level - 1) * 100);
    
    const tick = () => {
      const current = gameStateRef.current;
      if (current.currentPiece && !current.gameOver && !current.isPaused) {
        movePiece(0, 1);
      }
    };
    
    const interval = setInterval(tick, speed);
    return () => clearInterval(interval);
  }, [gameState.gameOver, gameState.isPaused, gameState.level, movePiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.gameOver) {
        if (e.key === 'Enter') resetGame();
        return;
      }
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
  }, [gameState.gameOver, movePiece, rotatePiece, hardDrop, togglePause, toggleGhost, resetGame]);

  // Calculate ghost piece position
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
