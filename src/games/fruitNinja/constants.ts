// 과일 종류
export const FRUITS = [
  { emoji: '🍎', name: 'apple', color: '#ff6b6b', points: 1 },
  { emoji: '🍊', name: 'orange', color: '#ffa502', points: 1 },
  { emoji: '🍋', name: 'lemon', color: '#fff200', points: 1 },
  { emoji: '🍉', name: 'watermelon', color: '#2ed573', points: 2 },
  { emoji: '🍇', name: 'grape', color: '#8e44ad', points: 2 },
  { emoji: '🍓', name: 'strawberry', color: '#ee5a5a', points: 1 },
  { emoji: '🥝', name: 'kiwi', color: '#7cb342', points: 2 },
  { emoji: '🍑', name: 'peach', color: '#ffb7b2', points: 1 },
];

export const BOMB = { emoji: '💣', name: 'bomb', color: '#2d3436' };

// 게임 설정
export const GRAVITY = 0.4;
export const INITIAL_LIVES = 3;
export const SPAWN_INTERVAL_BASE = 1500; // ms
export const SPAWN_INTERVAL_MIN = 600;
export const DIFFICULTY_INCREASE_RATE = 0.98;

// 캔버스
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;
