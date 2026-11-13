import React from 'react';
import { useLocation } from 'react-router-dom';
import './TileFit.css';

// Keep the standalone canvas game isolated from the other games' global styles.
const TileFit: React.FC = () => {
  const { search } = useLocation();
  return (
    <main className="tile-fit-page">
      <iframe
        className="tile-fit-frame"
        title="틈, 맞춤 — 마지막 한 장"
        src={`${process.env.PUBLIC_URL}/games/tile-fit/index.html${search}`}
      />
    </main>
  );
};

export default TileFit;
