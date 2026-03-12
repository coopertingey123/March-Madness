import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getGameByCode,
  getRounds,
  getPlayers,
  getAssignmentsForRound,
  getPlayerScores,
} from '../lib/db';
import type { GameSession, Round, Player, Assignment } from '../types';
import styles from './ViewGame.module.css';

export default function ViewGame() {
  const { code } = useParams<{ code: string }>();
  const [game, setGame] = useState<GameSession | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const found = await getGameByCode(code);
        if (!found) {
          setError('Game not found. Check the link with your host.');
          setLoading(false);
          return;
        }
        setGame(found);
        const [r, p, s] = await Promise.all([
          getRounds(found.id),
          getPlayers(found.id),
          getPlayerScores(),
        ]);
        setRounds(r);
        setPlayers(p);
        setScores(s);
        const initialRoundId = r[0]?.id ?? null;
        setSelectedRoundId(initialRoundId);
        if (initialRoundId) {
          const a = await getAssignmentsForRound(initialRoundId);
          setAssignments(a);
        }
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('Something went wrong loading this game.');
        setLoading(false);
      }
    })();
  }, [code]);

  useEffect(() => {
    if (!selectedRoundId) return;
    (async () => {
      const a = await getAssignmentsForRound(selectedRoundId);
      setAssignments(a);
    })();
  }, [selectedRoundId]);

  if (loading) return <p className={styles.loading}>Loading game…</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!game) return <p className={styles.error}>Game not found.</p>;

  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  const currentRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  return (
    <div className={styles.page}>
      <h1>{game.name}</h1>
      <p className={styles.sub}>Live view of spreads and scores. Read‑only for players.</p>

      <section className={styles.section}>
        <h2>Total points</h2>
        <ul className={styles.leaderboard}>
          {sortedPlayers.map((p, i) => (
            <li key={p.id} className={styles.leaderRow}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.points}>{scores[p.id] ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Round spreads</h2>
        <select
          value={selectedRoundId ?? ''}
          onChange={async (e) => {
            const id = e.target.value || null;
            setSelectedRoundId(id);
            if (id) {
              const a = await getAssignmentsForRound(id);
              setAssignments(a);
            }
          }}
        >
          <option value="">Select round</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {currentRound ? (
          <div className={styles.assignmentGrid}>
            {players.map((player) => {
              const playerAssignments = assignments
                .filter((a) => a.playerId === player.id)
                .sort((a, b) => a.spinOrder - b.spinOrder);
              if (playerAssignments.length === 0) return null;
              return (
                <div key={player.id} className={styles.assignmentCol}>
                  <div className={styles.assignmentHeader}>
                    <span className={styles.assignmentPlayer}>{player.name}</span>
                  </div>
                  <div className={styles.assignmentTags}>
                    {playerAssignments.map((a) => {
                      const gameItem = currentRound.games.find((g) => g.id === a.gameId);
                      if (!gameItem) return null;
                      return (
                        <span key={a.id} className={styles.assignmentTag}>
                          {gameItem.display}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.muted}>No round selected yet.</p>
        )}
      </section>
    </div>
  );
}

