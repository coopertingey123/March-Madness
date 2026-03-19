import { useState, useEffect, useRef } from 'react';
import {
  getPlayers,
  getRounds,
  getRound,
  getAssignmentsForRound,
  getPlayerScores,
  getRemainingGamesForRespin,
  setAssignmentHit,
  replaceAssignmentGame,
} from '../lib/db';
import type { Player, Round, Assignment, Game } from '../types';
import styles from './Scoreboard.module.css';
import { useGame } from '../context/GameContext';
import WheelComponent from '../components/Wheel';

export default function Scoreboard() {
  const { currentGame, role } = useGame();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [roundDetail, setRoundDetail] = useState<Round | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [respinTargetAssignmentId, setRespinTargetAssignmentId] = useState<string | null>(null);
  const respinTargetAssignmentIdRef = useRef<string | null>(null);
  const [respinSpinSignal, setRespinSpinSignal] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);

  useEffect(() => {
    if (!currentGame) return;
    Promise.all([getPlayers(currentGame.id), getRounds(currentGame.id), getPlayerScores()]).then(([p, r, s]) => {
      setPlayers(p);
      setRounds(r);
      setScores(s);
      setLoading(false);
    });
  }, [currentGame]);

  useEffect(() => {
    if (!selectedRoundId) {
      setRoundDetail(null);
      setAssignments([]);
      return;
    }
    Promise.all([
      getRound(selectedRoundId),
      getAssignmentsForRound(selectedRoundId),
    ]).then(([round, a]) => {
      setRoundDetail(round ?? null);
      setAssignments(a);
    });
  }, [selectedRoundId]);

  const refreshSelectedRound = async (roundId: string) => {
    const [newAssignments, newScores] = await Promise.all([
      getAssignmentsForRound(roundId),
      getPlayerScores(),
    ]);
    setAssignments(newAssignments);
    setScores(newScores);
  };

  const handleRespinComplete = async (game: Game) => {
    const targetId = respinTargetAssignmentIdRef.current;
    if (!roundDetail || !targetId) return;
    await replaceAssignmentGame(targetId, game.id);
    await refreshSelectedRound(roundDetail.id);
    respinTargetAssignmentIdRef.current = null;
    setRespinTargetAssignmentId(null);
  };

  const handleSetOutcome = async (roundId: string, assignmentId: string, isWin: boolean) => {
    await setAssignmentHit(assignmentId, isWin);
    const [newAssignments, newScores] = await Promise.all([
      getAssignmentsForRound(roundId),
      getPlayerScores(),
    ]);
    setAssignments(newAssignments);
    setScores(newScores);
  };

  if (!currentGame) {
    return <p className={styles.loading}>Join or create a game first.</p>;
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)
  );

  return (
    <div className={styles.page}>
      <h1>Scoreboard</h1>

      <section className={styles.totals}>
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

      <section className={styles.results}>
        <h2>Mark wins and losses</h2>
        <p className={styles.help}>
          Pick a round, then mark each spread as a <strong>Win</strong> or <strong>Loss</strong>.
          A win adds +1 point to that player’s total; a loss does not change their score.
        </p>
        <select
          value={selectedRoundId ?? ''}
          onChange={(e) => setSelectedRoundId(e.target.value || null)}
        >
          <option value="">Select round</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {roundDetail && (
          <>
            <div className={styles.gameList}>
              {roundDetail.games.map((game) => {
                const assignment = assignments.find((a) => a.gameId === game.id);
                const player = assignment ? players.find((p) => p.id === assignment.playerId) : null;
                const status = assignment?.hit;
                return (
                  <div key={game.id} className={styles.gameRow}>
                    <span className={styles.spread}>{game.display}</span>
                    <span className={styles.owner}>{player ? player.name : '—'}</span>
                    <span className={styles.result}>
                      {status === true && <span className={styles.hit}>Win</span>}
                      {status === false && <span className={styles.miss}>Loss</span>}
                      {status == null && <span className={styles.result}>—</span>}
                    </span>
                    {role === 'host' && assignment && (
                      <div className={styles.outcomeButtons}>
                        <button
                          type="button"
                          className={styles.repinBtn}
                          disabled={wheelSpinning || respinTargetAssignmentId != null}
                          onClick={() => {
                            respinTargetAssignmentIdRef.current = assignment.id;
                            setRespinTargetAssignmentId(assignment.id);
                            setRespinSpinSignal((s) => s + 1);
                          }}
                        >
                          Re-spin
                        </button>
                        <button
                          type="button"
                          className={styles.winBtn}
                          disabled={wheelSpinning || respinTargetAssignmentId != null}
                          onClick={() => handleSetOutcome(roundDetail.id, assignment.id, true)}
                        >
                          Win
                        </button>
                        <button
                          type="button"
                          className={styles.lossBtn}
                          disabled={wheelSpinning || respinTargetAssignmentId != null}
                          onClick={() => handleSetOutcome(roundDetail.id, assignment.id, false)}
                        >
                          Loss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {roundDetail && respinTargetAssignmentId && (
        <div className={styles.respinOverlay} role="dialog" aria-modal="true">
          <div className={styles.respinModal}>
            <div className={styles.respinHeader}>
              <h3>Re-spin</h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  respinTargetAssignmentIdRef.current = null;
                  setRespinTargetAssignmentId(null);
                }}
              >
                Close
              </button>
            </div>
            <p className={styles.respinHelp}>This replaces the current spread selection for the chosen player.</p>
            <WheelComponent
              segments={getRemainingGamesForRespin(roundDetail, assignments, respinTargetAssignmentId)}
              onSpinComplete={handleRespinComplete}
              disabled={wheelSpinning}
              onSpinningChange={setWheelSpinning}
              spinSignal={respinSpinSignal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
