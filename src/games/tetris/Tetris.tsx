import React from 'react';
import { useTetris } from './useTetris';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE, TETROMINOS } from './constants';
import './Tetris.css';

const Tetris: React.FC = () => {
  const { gameState, movePiece, rotatePiece, hardDrop, togglePause, resetGame } = useTetris();
  const { board, currentPiece, nextPiece, score, lines, level, gameOver, isPaused } = gameState;

  // Create display board with current piece
  const displayBoard = board.map(row => [...row]);
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

  return (
    <div className="tetris-container">
      <div className="tetris-game">
        <div className="tetris-left">
          <div className="tetris-info">
            <div className="info-item">
              <span className="info-label">점수</span>
              <span className="info-value">{score.toLocaleString()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">라인</span>
              <span className="info-value">{lines}</span>
            </div>
            <div className="info-item">
              <span className="info-label">레벨</span>
              <span className="info-value">{level}</span>
            </div>
          </div>
        </div>

        <div className="tetris-board-wrapper">
          <div
            className="tetris-board"
            style={{
              width: BOARD_WIDTH * CELL_SIZE,
              height: BOARD_HEIGHT * CELL_SIZE,
            }}
          >
            {displayBoard.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${y}-${x}`}
                  className={`tetris-cell ${cell ? 'filled' : ''}`}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: cell || 'transparent',
                  }}
                />
              ))
            )}
          </div>

          {(gameOver || isPaused) && (
            <div className="tetris-overlay">
              <div className="overlay-content">
                {gameOver ? (
                  <>
                    <h2>게임 오버!</h2>
                    <p>점수: {score.toLocaleString()}</p>
                    <button onClick={resetGame}>다시 하기</button>
                    <p className="hint">또는 Enter 키</p>
                  </>
                ) : (
                  <>
                    <h2>일시 정지</h2>
                    <button onClick={togglePause}>계속하기</button>
                    <p className="hint">또는 P 키</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="tetris-right">
          <div className="next-piece-container">
            <span className="info-label">다음 블록</span>
            <div className="next-piece-grid">
              {nextPieceShape.shape.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`next-${y}-${x}`}
                    className={`next-cell ${cell ? 'filled' : ''}`}
                    style={{
                      backgroundColor: cell ? nextPieceShape.color : 'transparent',
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div className="tetris-controls">
            <span className="info-label">조작법</span>
            <div className="controls-list">
              <div>← → 이동</div>
              <div>↑ 회전</div>
              <div>↓ 빠르게</div>
              <div>Space 드롭</div>
              <div>P 일시정지</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="mobile-controls">
        <div className="mobile-row">
          <button className="mobile-btn" onClick={rotatePiece}>↻</button>
        </div>
        <div className="mobile-row">
          <button className="mobile-btn" onClick={() => movePiece(-1, 0)}>←</button>
          <button className="mobile-btn" onClick={hardDrop}>⤓</button>
          <button className="mobile-btn" onClick={() => movePiece(1, 0)}>→</button>
        </div>
        <div className="mobile-row">
          <button className="mobile-btn" onClick={() => movePiece(0, 1)}>↓</button>
        </div>
      </div>
    </div>
  );
};

export default Tetris;
