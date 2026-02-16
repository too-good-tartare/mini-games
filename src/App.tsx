import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Tetris from './games/tetris';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="nav-bar">
          <Link to="/" className="nav-logo">🎮 미니 게임</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tetris" element={<Tetris />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
