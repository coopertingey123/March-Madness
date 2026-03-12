import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getRound,
  getPlayers,
  getAssignmentsForRound,
  getRemainingGames,
  createAssignment,
  updateRoundSpin,
} from '../lib/db';
import { useGame } from '../context/GameContext';
import WheelComponent from '../components/Wheel';
import type { Round, Player, Game, Assignment as AssignmentType } from '../types';
import styles from './WheelPage.module.css';

const LOOPS = 3;
const PLAYER_COUNT = 10;
const SPINS_PER_ROUND = LOOPS * PLAYER_COUNT;

export default function WheelPage() {
  const { currentGame, role } = useGame();
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [assignments, setAssignments] = useState<AssignmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLanded, setLastLanded] = useState<{ game: Game; playerName: string } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinSignal, setSpinSignal] = useState(0);

  const remaining = round ? getRemainingGames(round, assignments) : [];
  const currentSpin = round?.currentSpin ?? 0;
  const nextPlayerIndex = currentSpin % players.length;
  const nextPlayer = players[nextPlayerIndex] ?? null;

  useEffect(() => {
    if (!roundId || !currentGame) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getRound(roundId), getPlayers(currentGame.id), getAssignmentsForRound(roundId)]).then(
      ([r, p, a]) => {
        setRound(r ?? null);
        setPlayers(p);
        setAssignments(a);
        setLoading(false);
      }
    );
  }, [roundId, currentGame]);

  const handleSpinComplete = async (game: Game) => {
    if (!round || !nextPlayer) return;
    await createAssignment(round.id, game.id, nextPlayer.id, currentSpin + 1);
    const newSpin = currentSpin + 1;
    const isComplete = newSpin >= Math.min(round.games.length, SPINS_PER_ROUND);
    await updateRoundSpin(round.id, newSpin, isComplete ? new Date().toISOString() : undefined);
    setAssignments([
      ...assignments,
      {
        id: '',
        roundId: round.id,
        gameId: game.id,
        playerId: nextPlayer.id,
        spinOrder: newSpin,
      },
    ]);
    setRound((prev) => (prev ? { ...prev, currentSpin: newSpin, completedAt: prev.completedAt } : null));
    setLastLanded({ game, playerName: nextPlayer.name });
  };

  if (!currentGame) {
    return <p className={styles.loading}>Join or create a game first.</p>;
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  if (!roundId) {
    return (
      <div className={styles.page}>
        <h1>Wheel</h1>
        <p>Select a round to spin.</p>
        <Link to="/rounds" className={styles.link}>Go to Rounds</Link>
      </div>
    );
  }

  if (!round) {
    return (
      <div className={styles.page}>
        <h1>Round not found</h1>
        <Link to="/rounds" className={styles.link}>Back to Rounds</Link>
      </div>
    );
  }

  const done = currentSpin >= Math.min(round.games.length, SPINS_PER_ROUND);

  const canSpin = role === 'host' && !done && !!nextPlayer && remaining.length > 0 && !spinning;

  const triggerSpin = () => {
    if (!canSpin) return;
    setSpinSignal((s) => s + 1);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{round.name}</h1>
        <p className={styles.meta}>
          Spin {currentSpin} of {Math.min(round.games.length, SPINS_PER_ROUND)}
          {nextPlayer && !done && ` · Next: ${nextPlayer.name}`}
        </p>
      </div>

      {lastLanded && (
        <div className={styles.landed}>
          <strong>{lastLanded.playerName}</strong> got <strong>{lastLanded.game.display}</strong>
        </div>
      )}

      <div className={styles.mainRow}>
        <div className={styles.wheelCol}>
          <WheelComponent
            segments={remaining}
            onSpinComplete={handleSpinComplete}
            disabled={done || players.length === 0}
            onSpinningChange={setSpinning}
            spinSignal={spinSignal}
          />
        </div>
        <aside className={styles.infoCol}>
          <h2>Current spin</h2>
          {done || !nextPlayer ? (
            <p className={styles.muted}>Wheel is complete for this round.</p>
          ) : (
            <>
              <div className={styles.currentPlayerCard}>
                <span className={styles.currentLabel}>
                  {spinning ? 'Spinning for' : 'Up next'}
                </span>
                <span className={styles.currentName}>{nextPlayer.name}</span>
              </div>
              <p className={styles.mutedSmall}>
                Remaining spreads on wheel: {remaining.length}
              </p>
              {role === 'host' ? (
                <button
                  type="button"
                  className={styles.spinBtn}
                  onClick={triggerSpin}
                  disabled={!canSpin}
                >
                  {spinning ? 'Spinning…' : 'Spin wheel'}
                </button>
              ) : (
                <p className={styles.mutedSmall}>Only the host can spin the wheel.</p>
              )}
            </>
          )}
        </aside>
      </div>

      {done && (
        <div className={styles.done}>
          <p>Wheel complete for this round.</p>
          <Link to="/scoreboard" className={styles.link}>View scoreboard</Link>
          <button type="button" onClick={() => navigate('/rounds')}>Back to Rounds</button>
        </div>
      )}

      <section className={styles.assignments}>
        <h2>Assignments this round</h2>
        {assignments.length === 0 ? (
          <p className={styles.muted}>No assignments yet. Spin the wheel.</p>
        ) : (
          <div className={styles.assignmentGrid}>
            {players.map((player) => {
              const playerAssignments = assignments
                .filter((a) => a.playerId === player.id)
                .sort((a, b) => a.spinOrder - b.spinOrder);
              if (playerAssignments.length === 0) return null;
              return (
                <div key={player.id} className={styles.assignmentCol}>
                  <h3 className={styles.assignmentPlayer}>{player.name}</h3>
                  <div className={styles.assignmentTags}>
                    {playerAssignments.map((a) => {
                      const game = round.games.find((g) => g.id === a.gameId);
                      if (!game) return null;
                      return (
                        <span key={a.id} className={styles.assignmentTag}>
                          {game.display}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
