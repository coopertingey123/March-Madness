import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Players from './pages/Players';
import Rounds from './pages/Rounds';
import Wheel from './pages/Wheel';
import Scoreboard from './pages/Scoreboard';
import ViewGame from './pages/ViewGame';
import styles from './App.module.css';
import { useGame } from './context/GameContext';

function App() {
  const { currentGame, role, clearGame } = useGame();
  const location = useLocation();
  const hasGame = !!currentGame;
  const onHome = location.pathname === '/';
  const isViewer = location.pathname.startsWith('/view');

  return (
    <div className={styles.app}>
      {isViewer ? (
        <nav className={styles.nav}>
          <div className={styles.brand}>
            <span className={styles.logo}>Spread Wheel</span>
          </div>
        </nav>
      ) : (
        !onHome &&
        hasGame && (
          <nav className={styles.nav}>
            <div className={styles.brand}>
              <NavLink to="/dashboard" className={styles.logo}>
                Spread Wheel
              </NavLink>
              <div className={styles.gameMeta}>
                <span className={styles.gameName}>{currentGame?.name}</span>
                <span className={styles.gameCode}>Code: {currentGame?.hostCode}</span>
                {role && <span className={styles.gameRole}>{role === 'host' ? 'Host' : 'Player'}</span>}
              </div>
            </div>
            <div className={styles.navLinks}>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? styles.active : '')} end>
                Dashboard
              </NavLink>
              <NavLink to="/players" className={({ isActive }) => (isActive ? styles.active : '')}>
                Players
              </NavLink>
              <NavLink to="/rounds" className={({ isActive }) => (isActive ? styles.active : '')}>
                Rounds
              </NavLink>
              <NavLink to="/scoreboard" className={({ isActive }) => (isActive ? styles.active : '')}>
                Scoreboard
              </NavLink>
              <button type="button" className={styles.changeGame} onClick={clearGame}>
                Change game
              </button>
            </div>
          </nav>
        )
      )}
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/view/:code" element={<ViewGame />} />
          <Route path="/players" element={<Players />} />
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/wheel" element={<Wheel />} />
          <Route path="/wheel/:roundId" element={<Wheel />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
