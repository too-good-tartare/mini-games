import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FRUITS, BOMB, GRAVITY, INITIAL_LIVES, CANVAS_WIDTH, CANVAS_HEIGHT, SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_MIN, DIFFICULTY_INCREASE_RATE } from './constants';
import { Fruit, SlicedHalf, SliceTrail, GameState, FruitType } from './types';
import './FruitNinja.css';

const STORAGE_KEY = 'fruit-ninja-best';

let nextId = 0;

const FruitNinja: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const slicedHalvesRef = useRef<SlicedHalf[]>([]);
  const trailRef = useRef<SliceTrail[]>([]);
  const gameStateRef = useRef<GameState>({
    score: 0,
    lives: INITIAL_LIVES,
    combo: 0,
    maxCombo: 0,
    isPlaying: false,
    isGameOver: false,
    bestScore: parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10),
  });
  
  const [displayState, setDisplayState] = useState<GameState>(gameStateRef.current);
  const animationRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const spawnIntervalRef = useRef<number>(SPAWN_INTERVAL_BASE);
  const isSlicingRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  // 과일 생성
  const spawnFruit = useCallback(() => {
    const isBomb = Math.random() < 0.15; // 15% 확률로 폭탄
    const type: FruitType = isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    
    const x = Math.random() * (CANVAS_WIDTH - 100) + 50;
    const targetX = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 200;
    const vx = (targetX - x) * 0.02;
    const vy = -(12 + Math.random() * 4); // 위로 던지기
    
    const fruit: Fruit = {
      id: nextId++,
      type,
      x,
      y: CANVAS_HEIGHT + 50,
      vx,
      vy,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      radius: 35,
      sliced: false,
      isBomb,
    };
    
    fruitsRef.current.push(fruit);
  }, []);

  // 과일 슬라이스
  const sliceFruit = useCallback((fruit: Fruit) => {
    if (fruit.sliced) return;
    fruit.sliced = true;
    
    const state = gameStateRef.current;
    
    if (fruit.isBomb) {
      // 폭탄 터짐 - 게임 오버
      state.isGameOver = true;
      state.isPlaying = false;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        localStorage.setItem(STORAGE_KEY, String(state.score));
      }
    } else {
      // 점수 추가
      state.combo++;
      state.score += (fruit.type.points || 1) * state.combo;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      
      // 반쪽 생성
      const baseVx = fruit.vx;
      const baseVy = fruit.vy;
      
      slicedHalvesRef.current.push(
        {
          id: nextId++,
          emoji: fruit.type.emoji,
          x: fruit.x - 10,
          y: fruit.y,
          vx: baseVx - 3,
          vy: baseVy - 2,
          rotation: fruit.rotation,
          rotationSpeed: -0.15,
          opacity: 1,
          side: 'left',
        },
        {
          id: nextId++,
          emoji: fruit.type.emoji,
          x: fruit.x + 10,
          y: fruit.y,
          vx: baseVx + 3,
          vy: baseVy - 2,
          rotation: fruit.rotation,
          rotationSpeed: 0.15,
          opacity: 1,
          side: 'right',
        }
      );
    }
    
    setDisplayState({ ...state });
  }, []);

  // 충돌 감지
  const checkSlice = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    fruitsRef.current.forEach(fruit => {
      if (fruit.sliced) return;
      
      // 선분과 원의 충돌 감지
      const dx = x2 - x1;
      const dy = y2 - y1;
      const fx = x1 - fruit.x;
      const fy = y1 - fruit.y;
      
      const a = dx * dx + dy * dy;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - fruit.radius * fruit.radius;
      
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t >= 0 && t <= 1) {
          sliceFruit(fruit);
        }
      }
    });
  }, [sliceFruit]);

  // 게임 루프
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const state = gameStateRef.current;
    
    if (state.isPlaying && !state.isGameOver) {
      // 과일 스폰
      if (timestamp - lastSpawnRef.current > spawnIntervalRef.current) {
        spawnFruit();
        lastSpawnRef.current = timestamp;
        // 난이도 상승
        spawnIntervalRef.current = Math.max(
          SPAWN_INTERVAL_MIN,
          spawnIntervalRef.current * DIFFICULTY_INCREASE_RATE
        );
      }
      
      // 콤보 리셋 타이머 (슬라이싱 안하면 콤보 리셋)
      if (!isSlicingRef.current && state.combo > 0) {
        state.combo = 0;
        setDisplayState({ ...state });
      }
    }
    
    // 캔버스 클리어
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 배경
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 슬라이스 궤적 그리기
    if (trailRef.current.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
      trailRef.current.forEach((point, i) => {
        if (i > 0) ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // 궤적 페이드아웃
      trailRef.current = trailRef.current
        .map(p => ({ ...p, age: p.age + 1 }))
        .filter(p => p.age < 10);
    }
    
    // 과일 업데이트 & 그리기
    fruitsRef.current = fruitsRef.current.filter(fruit => {
      if (fruit.sliced) return false;
      
      // 물리 업데이트
      fruit.vy += GRAVITY;
      fruit.x += fruit.vx;
      fruit.y += fruit.vy;
      fruit.rotation += fruit.rotationSpeed;
      
      // 화면 밖으로 나감 (놓침)
      if (fruit.y > CANVAS_HEIGHT + 100) {
        if (!fruit.isBomb && state.isPlaying) {
          state.lives--;
          state.combo = 0;
          if (state.lives <= 0) {
            state.isGameOver = true;
            state.isPlaying = false;
            if (state.score > state.bestScore) {
              state.bestScore = state.score;
              localStorage.setItem(STORAGE_KEY, String(state.score));
            }
          }
          setDisplayState({ ...state });
        }
        return false;
      }
      
      // 그리기
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      ctx.font = `${fruit.radius * 1.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.type.emoji, 0, 0);
      ctx.restore();
      
      return true;
    });
    
    // 반쪽 조각 업데이트 & 그리기
    slicedHalvesRef.current = slicedHalvesRef.current.filter(half => {
      half.vy += GRAVITY;
      half.x += half.vx;
      half.y += half.vy;
      half.rotation += half.rotationSpeed;
      half.opacity -= 0.015;
      
      if (half.opacity <= 0 || half.y > CANVAS_HEIGHT + 100) return false;
      
      ctx.save();
      ctx.globalAlpha = half.opacity;
      ctx.translate(half.x, half.y);
      ctx.rotate(half.rotation);
      
      // 클리핑으로 반쪽만 표시
      ctx.beginPath();
      if (half.side === 'left') {
        ctx.rect(-40, -40, 40, 80);
      } else {
        ctx.rect(0, -40, 40, 80);
      }
      ctx.clip();
      
      ctx.font = '60px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(half.emoji, 0, 0);
      ctx.restore();
      
      return true;
    });
    
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [spawnFruit]);

  // 마우스/터치 이벤트
  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!gameStateRef.current.isPlaying) return;
    isSlicingRef.current = true;
    const pos = getCanvasPos(e);
    lastMouseRef.current = pos;
    trailRef.current = [{ ...pos, age: 0 }];
  }, [getCanvasPos]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isSlicingRef.current || !gameStateRef.current.isPlaying) return;
    
    const pos = getCanvasPos(e);
    if (lastMouseRef.current) {
      checkSlice(lastMouseRef.current.x, lastMouseRef.current.y, pos.x, pos.y);
    }
    lastMouseRef.current = pos;
    trailRef.current.push({ ...pos, age: 0 });
    if (trailRef.current.length > 20) trailRef.current.shift();
  }, [getCanvasPos, checkSlice]);

  const handleEnd = useCallback(() => {
    isSlicingRef.current = false;
    lastMouseRef.current = null;
  }, []);

  // 게임 시작
  const startGame = useCallback(() => {
    nextId = 0;
    fruitsRef.current = [];
    slicedHalvesRef.current = [];
    trailRef.current = [];
    spawnIntervalRef.current = SPAWN_INTERVAL_BASE;
    lastSpawnRef.current = 0;
    
    gameStateRef.current = {
      ...gameStateRef.current,
      score: 0,
      lives: INITIAL_LIVES,
      combo: 0,
      maxCombo: 0,
      isPlaying: true,
      isGameOver: false,
    };
    setDisplayState({ ...gameStateRef.current });
  }, []);

  // 게임 루프 시작
  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  return (
    <div className="fruit-ninja-container">
      <div className="fruit-ninja-header">
        <div className="score">🎯 {displayState.score}</div>
        <div className="lives">
          {'❤️'.repeat(displayState.lives)}
          {'🖤'.repeat(INITIAL_LIVES - displayState.lives)}
        </div>
        <div className="best">👑 {displayState.bestScore}</div>
      </div>
      
      {displayState.combo > 1 && (
        <div className="combo">x{displayState.combo} COMBO!</div>
      )}
      
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
      
      {!displayState.isPlaying && (
        <div className="overlay">
          <div className="overlay-content">
            {displayState.isGameOver ? (
              <>
                <h2>💥 게임 오버!</h2>
                <p>점수: {displayState.score}</p>
                <p>최대 콤보: x{displayState.maxCombo}</p>
              </>
            ) : (
              <>
                <h2>🍉 Fruit Ninja</h2>
                <p>과일을 스와이프해서 자르세요!</p>
                <p>💣 폭탄 주의!</p>
              </>
            )}
            <button onClick={startGame}>
              {displayState.isGameOver ? '다시 하기' : '게임 시작'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FruitNinja;
