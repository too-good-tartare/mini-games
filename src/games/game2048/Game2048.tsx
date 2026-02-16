import React, { useRef, useCallback } from 'react';
import { use2048 } from './use2048';
import { GRID_SIZE, TILE_COLORS } from './constants';
import './Game2048.css';

const Game2048: React.FC = () => {
  const { grid, score, bestScore, gameOver, won, keepPlaying, handleMove, undo, reset, continuePlaying, canUndo, newTilePos, mergedPositions } = use2048({});
  
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 30) return;
    if (absDx > absDy) handleMove(dx > 0 ? 'right' : 'left');
    else handleMove(dy > 0 ? 'down' : 'up');
    touchStart.current = null;
  }, [handleMove]);

  const getTileStyle = (value: number) => {
    const colors = TILE_COLORS[value] || TILE_COLORS[4096];
    return { backgroundColor: colors.bg, color: colors.text };
  };

  return (
    <div className="game2048-container">
      <div className="game2048-header">
        <h1>2048</h1>
        <div className="scores">
          <div className="score-box"><span className="label">점수</span><span className="value">{score}</span></div>
          <div className="score-box"><span className="label">최고</span><span className="value">{bestScore}</span></div>
        </div>
      </div>

      <div className="game2048-controls">
        <button onClick={reset}>새 게임</button>
        <button onClick={undo} disabled={!canUndo}>↩ 되돌리기</button>
      </div>

      <div className="game2048-board" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="grid-bg">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => <div key={i} className="cell-bg" />)}
        </div>
        <div className="tiles">
          {grid.map((row, r) => row.map((cell, c) => {
            if (!cell) return null;
            const isNew = newTilePos && newTilePos[0] === r && newTilePos[1] === c;
            const isMerged = mergedPositions.some(([mr, mc]) => mr === r && mc === c);
            return (
              <div key={`${r}-${c}`} className={`tile${isNew ? ' new' : ''}${isMerged ? ' merged' : ''}`} style={{ 
                ...getTileStyle(cell), 
                top: `calc(${r} * (100% - 24px) / 4 + ${r} * 8px)`,
                left: `calc(${c} * (100% - 24px) / 4 + ${c} * 8px)`
              }}>
                {cell}
              </div>
            );
          }))}
        </div>
        
        {(gameOver || (won && !keepPlaying)) && (
          <div className="game2048-overlay">
            <div className="overlay-content">
              <h2>{won ? '🎉 승리!' : '😢 게임 오버'}</h2>
              <p>점수: {score}</p>
              {won && !keepPlaying && <button onClick={continuePlaying}>계속하기</button>}
              <button onClick={reset}>다시 하기</button>
            </div>
          </div>
        )}
      </div>

      <div className="game2048-instructions">
        <p>스와이프 또는 방향키로 블록을 움직이세요</p>
      </div>
    </div>
  );
};

export default Game2048;
