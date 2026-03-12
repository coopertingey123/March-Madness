import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createGame, getGameByCode } from '../lib/db';
import { useGame } from '../context/GameContext';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentGame, setGame } = useGame();
  const [newGameName, setNewGameName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newGameName.trim() || 'March Madness Game';
    setCreating(true);
    setError(null);
    try {
      const game = await createGame(name);
      setGame(game, 'host');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Could not create game. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    setJoining(true);
    setError(null);
    try {
      const game = await getGameByCode(code);
      if (!game) {
        setError('Game not found. Check the code and try again.');
      } else {
        setGame(game, 'host');
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Could not join game. Try again.');
    } finally {
      setJoining(false);
    }
  };

  const onDashboard = location.pathname === '/dashboard' && currentGame;

  if (onDashboard && currentGame) {
    const viewerUrl = `${window.location.origin}/view/${currentGame.hostCode}`;
    return (
      <div className={styles.home}>
        <h1>{currentGame.name}</h1>
        <p className={styles.tagline}>
          Game code: <strong>{currentGame.hostCode}</strong>
        </p>
        <p className={styles.viewer}>
          Send this link to your players (view only):{' '}
          <span className={styles.viewerLink}>{viewerUrl}</span>
        </p>
        <div className={styles.dashboardLinks}>
          <button type="button" onClick={() => navigate('/players')}>Players</button>
          <button type="button" onClick={() => navigate('/rounds')}>Rounds</button>
          <button type="button" onClick={() => navigate('/scoreboard')}>Scoreboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.home}>
      <h1>March Madness Spread Wheel</h1>
      <p className={styles.tagline}>
        Create a game for your group, or join an existing one with a code.
      </p>
      <div className={styles.cards}>
        <form className={styles.card} onSubmit={handleCreate}>
          <h2>Create new game</h2>
          <p>Name your game and get a code to share.</p>
          <input
            type="text"
            placeholder="Game name (e.g. 2026 Friends Pool)"
            value={newGameName}
            onChange={(e) => setNewGameName(e.target.value)}
          />
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create game'}
          </button>
        </form>
        <form className={styles.card} onSubmit={handleJoin}>
          <h2>Join existing game</h2>
          <p>Enter the game code your host shared.</p>
          <input
            type="text"
            placeholder="Game code (e.g. A7K9XZ)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button type="submit" disabled={joining}>
            {joining ? 'Joining…' : 'Join game'}
          </button>
        </form>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
