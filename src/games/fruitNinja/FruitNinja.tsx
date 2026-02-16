import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FRUITS, BOMB, GRAVITY, INITIAL_LIVES, CANVAS_WIDTH, CANVAS_HEIGHT, SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_MIN, DIFFICULTY_INCREASE_RATE } from './constants';
import { Fruit, SlicedHalf, SliceTrail, GameState, FruitType } from './types';
import './FruitNinja.css';

const STORAGE_KEY = 'fruit-ninja-best';

// 색상 밝기 조절 헬퍼
const shadeColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

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
      
      const r = fruit.radius;
      
      if (fruit.isBomb) {
        // 폭탄 그리기
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = '#2d3436';
        ctx.fill();
        
        // 폭탄 하이라이트
        ctx.beginPath();
        ctx.arc(-r * 0.25, -r * 0.25, r * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
        
        // 심지
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(r * 0.3, -r * 1.3, r * 0.1, -r * 1.5);
        ctx.strokeStyle = '#a17f1a';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // 불꽃
        ctx.beginPath();
        ctx.arc(r * 0.1, -r * 1.55, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b35';
        ctx.fill();
      } else {
        // 과일별 그리기
        const name = fruit.type.name;
        
        if (name === 'watermelon') {
          // 수박 - 녹색 껍질 + 빨간 속
          const grad = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
          grad.addColorStop(0, '#ff6b6b');
          grad.addColorStop(0.7, '#ee5253');
          grad.addColorStop(0.85, '#fff');
          grad.addColorStop(1, '#2ed573');
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // 줄무늬
          ctx.strokeStyle = '#1e8449';
          ctx.lineWidth = 2;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r, Math.PI * (0.3 + i * 0.15), Math.PI * (0.7 + i * 0.15));
            ctx.stroke();
          }
        } else if (name === 'orange') {
          // 오렌지
          const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
          grad.addColorStop(0, '#ffa502');
          grad.addColorStop(1, '#e67e22');
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // 텍스처 점
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (name === 'apple') {
          // 사과
          const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
          grad.addColorStop(0, '#ff6b6b');
          grad.addColorStop(1, '#c0392b');
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // 잎
          ctx.beginPath();
          ctx.ellipse(r * 0.15, -r * 0.9, r * 0.35, r * 0.15, Math.PI * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#27ae60';
          ctx.fill();
          // 줄기
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.7);
          ctx.lineTo(0, -r * 1.1);
          ctx.strokeStyle = '#5d4e37';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (name === 'grape') {
          // 포도
          const positions = [[0, 0], [-r*0.4, -r*0.3], [r*0.4, -r*0.3], [-r*0.2, r*0.35], [r*0.2, r*0.35], [0, -r*0.55]];
          positions.forEach(([x, y]) => {
            const grad = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, r * 0.35);
            grad.addColorStop(0, '#a55eea');
            grad.addColorStop(1, '#6c3483');
            ctx.beginPath();
            ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
          });
          // 줄기
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.8);
          ctx.lineTo(0, -r * 1.2);
          ctx.strokeStyle = '#5d4e37';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (name === 'lemon') {
          // 레몬
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.2, 0, 0, 0, r);
          grad.addColorStop(0, '#fff200');
          grad.addColorStop(1, '#f1c40f');
          ctx.fillStyle = grad;
          ctx.fill();
          // 끝 점
          ctx.beginPath();
          ctx.arc(r * 0.95, 0, 4, 0, Math.PI * 2);
          ctx.arc(-r * 0.95, 0, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#d4ac0d';
          ctx.fill();
        } else if (name === 'strawberry') {
          // 딸기
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.8);
          ctx.quadraticCurveTo(-r, -r * 0.3, -r * 0.7, r * 0.6);
          ctx.quadraticCurveTo(0, r * 1.1, r * 0.7, r * 0.6);
          ctx.quadraticCurveTo(r, -r * 0.3, 0, -r * 0.8);
          const grad = ctx.createRadialGradient(0, r * 0.2, 0, 0, 0, r);
          grad.addColorStop(0, '#ff6b6b');
          grad.addColorStop(1, '#c0392b');
          ctx.fillStyle = grad;
          ctx.fill();
          // 씨앗
          ctx.fillStyle = '#f1c40f';
          const seeds = [[-r*0.3, 0], [r*0.3, 0], [0, r*0.4], [-r*0.2, r*0.5], [r*0.2, r*0.5]];
          seeds.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.ellipse(x, y, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
          });
          // 잎
          ctx.beginPath();
          ctx.moveTo(-r * 0.4, -r * 0.7);
          ctx.lineTo(0, -r * 0.5);
          ctx.lineTo(r * 0.4, -r * 0.7);
          ctx.lineTo(0, -r * 1);
          ctx.closePath();
          ctx.fillStyle = '#27ae60';
          ctx.fill();
        } else {
          // 기본 (키위, 복숭아 등)
          const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
          grad.addColorStop(0, fruit.type.color);
          grad.addColorStop(1, shadeColor(fruit.type.color, -30));
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // 하이라이트
          ctx.beginPath();
          ctx.arc(-r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fill();
        }
      }
      
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
      
      // 반원 그리기
      ctx.beginPath();
      if (half.side === 'left') {
        ctx.arc(0, 0, 30, Math.PI * 0.5, Math.PI * 1.5);
      } else {
        ctx.arc(0, 0, 30, -Math.PI * 0.5, Math.PI * 0.5);
      }
      ctx.closePath();
      
      // 과일 색상 찾기
      const fruitType = FRUITS.find(f => f.emoji === half.emoji);
      ctx.fillStyle = fruitType?.color || '#ff6b6b';
      ctx.fill();
      
      // 과육 표시 (안쪽)
      ctx.beginPath();
      if (half.side === 'left') {
        ctx.arc(5, 0, 22, Math.PI * 0.5, Math.PI * 1.5);
      } else {
        ctx.arc(-5, 0, 22, -Math.PI * 0.5, Math.PI * 0.5);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
      
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
          {Array.from({ length: displayState.lives }).map((_, i) => (
            <span key={i} className="heart full">♥</span>
          ))}
          {Array.from({ length: INITIAL_LIVES - displayState.lives }).map((_, i) => (
            <span key={i + displayState.lives} className="heart empty">♥</span>
          ))}
        </div>
        <div className="best">👑 {displayState.bestScore}</div>
      </div>
      
      <div className="fruit-ninja-game">
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
    </div>
  );
};

export default FruitNinja;
