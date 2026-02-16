import React, { useCallback } from 'react';
import { useTetris } from './useTetris';
import { useAudio } from './useAudio';
import { BOARD_WIDTH, BOARD_HEIGHT, TETROMINOS } from './constants';
import './Tetris.css';

const Tetris: React.FC = () => {
  const { isMuted, toggleMusic, playLineClear } = useAudio();
  
  const handleLineClear = useCallback((lineCount: number) => {
    playLineClear(lineCount);
  }, [playLineClear]);

  const { 
    gameState, 
    ghostY, 
    showGhost,
    movePiece, 
    rotatePiece, 
    hardDrop, 
    togglePause, 
    toggleGhost,
    resetGame 
  } = useTetris({ onLineClear: handleLineClear });
  
  const { board, currentPiece, nextPiece, score, lines, level, gameOver, isPaused, clearingLines } = gameState;

  // Create display board with ghost and current piece
  const displayBoard = board.map(row => [...row]);
  
  // Draw ghost piece first
  if (currentPiece && ghostY !== null && ghostY !== currentPiece.position.y) {
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = ghostY + y;
          const boardX = currentPiece.position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            if (!displayBoard[boardY][boardX]) {
              displayBoard[boardY][boardX] = `ghost:${currentPiece.color}`;
            }
          }
        }
      }
    }
  }
  
  // Draw current piece
  if (currentPiece) {
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = currentPiece.position.y + y;
          const boardX = currentPiece.position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            displayBoard[boardY][boardX] = currentPiece.color;
          }
        }
      }
    }
  }

  const nextPieceShape = TETROMINOS[nextPiece];

  const getCellStyle = (cell: string | null) => {
    if (!cell) return { backgroundColor: 'transparent' };
    if (cell.startsWith('ghost:')) {
      const color = cell.replace('ghost:', '');
      return {
        backgroundColor: 'transparent',
        border: `2px dashed ${color}`,
        opacity: 0.5,
      };
    }
    return { backgroundColor: cell };
  };

  const isLineClearing = (rowIndex: number) => clearingLines.includes(rowIndex);

  return (
    <div className="tetris-container">
      {/* Mobile: Stats row */}
      <div className="tetris-stats-row">
        <div className="stat-box">
          <span className="stat-label">점수</span>
          <span className="stat-value">{score.toLocaleString()}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">라인</span>
          <span className="stat-value">{lines}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">레벨</span>
          <span className="stat-value">{level}</span>
        </div>
      </div>

      {/* Mobile: Next piece row */}
      <div className="next-piece-row">
        <span className="next-label">다음</span>
        <div className="next-piece-grid">
          {nextPieceShape.shape.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`next-${y}-${x}`}
                className={`next-cell ${cell ? 'filled' : ''}`}
                style={{ backgroundColor: cell ? nextPieceShape.color : 'transparent' }}
              />
            ))
          )}
        </div>
      </div>

      <div className="tetris-game-wrapper">
        {/* Desktop sidebar left */}
        <div className="tetris-sidebar">
          <div className="stat-box-desktop">
            <span className="stat-label">점수</span>
            <span className="stat-value">{score.toLocaleString()}</span>
          </div>
          <div className="stat-box-desktop">
            <span className="stat-label">라인</span>
            <span className="stat-value">{lines}</span>
          </div>
          <div className="stat-box-desktop">
            <span className="stat-label">레벨</span>
            <span className="stat-value">{level}</span>
          </div>
        </div>

        {/* Game Board */}
        <div className="tetris-board-wrapper">
          <div className="board-top-buttons">
            <button className="top-btn music-btn" onClick={toggleMusic}>
              {isMuted ? '🔇' : '🎵'}
            </button>
            <button className="top-btn pause-btn" onClick={togglePause}>
              {isPaused ? '▶' : '⏸'}
            </button>
          </div>
          <div className="tetris-board">
            {displayBoard.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className={`tetris-cell ${cell && !cell.startsWith('ghost:') ? 'filled' : ''} ${cell?.startsWith('ghost:') ? 'ghost' : ''} ${isLineClearing(y) ? 'clearing' : ''}`}
                  style={getCellStyle(cell)}
                />
              ))
            )}
          </div>

          {(gameOver || isPaused) && (
            <div className="tetris-overlay">
              <div className="overlay-content">
                {gameOver ? (
                  <>
                    <h2>🎮 게임 오버</h2>
                    <p>최종 점수: {score.toLocaleString()}</p>
                    <p>클리어 라인: {lines}</p>
                    <button onClick={resetGame}>다시 하기</button>
                  </>
                ) : (
                  <>
                    <h2>⏸ 일시 정지</h2>
                    <button onClick={togglePause}>계속하기</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop sidebar right */}
        <div className="tetris-sidebar">
          <div className="next-piece-desktop">
            <span className="next-label">다음 블록</span>
            <div className="next-piece-grid">
              {nextPieceShape.shape.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`next-d-${y}-${x}`}
                    className={`next-cell ${cell ? 'filled' : ''}`}
                    style={{ backgroundColor: cell ? nextPieceShape.color : 'transparent' }}
                  />
                ))
              )}
            </div>
          </div>
          <div className="desktop-controls">
            <div className="ctrl-title">조작법</div>
            <div className="ctrl-list">
              <div>← → 이동</div>
              <div>↑ 회전</div>
              <div>↓ 빠르게</div>
              <div>Space 드롭</div>
              <div>P 일시정지</div>
              <div>G 가이드</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="mobile-controls">
        <div className="controls-row">
          <button className="ctrl-btn primary wide" onClick={rotatePiece}>
            ↻ 회전
          </button>
          <button className="ctrl-btn primary wide" onClick={hardDrop}>
            ⤓ 드롭
          </button>
        </div>
        <div className="controls-row">
          <button className="ctrl-btn" onClick={() => movePiece(-1, 0)}>
            ◀
          </button>
          <button className="ctrl-btn" onClick={() => movePiece(0, 1)}>
            ▼
          </button>
          <button className="ctrl-btn" onClick={() => movePiece(1, 0)}>
            ▶
          </button>
        </div>
        
        {/* Ghost toggle button */}
        <div className="controls-row">
          <button 
            className={`ctrl-btn ghost-toggle ${showGhost ? 'active' : ''}`} 
            onClick={toggleGhost}
          >
            👻 가이드 {showGhost ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tetris;
