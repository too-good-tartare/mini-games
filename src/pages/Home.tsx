import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

interface GameCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  available: boolean;
}

const games: GameCard[] = [
  {
    id: 'tetris',
    name: '테트리스',
    emoji: '🧱',
    description: '클래식 블록 퍼즐 게임',
    available: true,
  },
  {
    id: '2048',
    name: '2048',
    emoji: '🔢',
    description: '숫자 합치기 퍼즐',
    available: false,
  },
  {
    id: 'fruit-ninja',
    name: 'Fruit Ninja',
    emoji: '🍉',
    description: '과일 자르기 액션',
    available: false,
  },
];

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1>🎮 미니 게임</h1>
        <p>재미있는 게임을 즐겨보세요!</p>
      </header>

      <div className="games-grid">
        {games.map((game) => (
          <div key={game.id} className={`game-card ${!game.available ? 'coming-soon' : ''}`}>
            <div className="game-emoji">{game.emoji}</div>
            <div className="game-info">
              <h3>{game.name}</h3>
              <p>{game.description}</p>
            </div>
            {game.available ? (
              <Link to={`/${game.id}`} className="play-btn">
                ▶
              </Link>
            ) : (
              <span className="coming-soon-badge">Coming Soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
