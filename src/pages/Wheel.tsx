import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getRound,
  getPlayers,
  getAssignmentsForRound,
  getRemainingGames,
  getRemainingGamesForRespin,
  createAssignment,
  updateRoundSpin,
  replaceAssignmentGame,
  deleteAssignment,
  rewindRoundSpin,
  updateRoundEligiblePlayers,
} from '../lib/db';
import { useGame } from '../context/GameContext';
import WheelComponent from '../components/Wheel';
import type { Round, Player, Game, Assignment as AssignmentType } from '../types';
import styles from './WheelPage.module.css';

const LOOPS = 3;
function getEligiblePlayers(round: Round | null, players: Player[]): Player[] {
  if (!round || players.length === 0) return [];
  if (!round.eligiblePlayerIds || round.eligiblePlayerIds.length === 0) return players;
  const eligible = players.filter((player) => round.eligiblePlayerIds?.includes(player.id));
  return eligible.length > 0 ? eligible : players;
}

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
  const [respinTarget, setRespinTarget] = useState<AssignmentType | null>(null);
  const [savingEligiblePlayers, setSavingEligiblePlayers] = useState(false);
  const respinTargetRef = useRef<AssignmentType | null>(null);

  const remaining = round
    ? respinTarget
      ? getRemainingGamesForRespin(round, assignments, respinTarget.id)
      : getRemainingGames(round, assignments)
    : [];
  const currentSpin = round?.currentSpin ?? 0;
  const eligiblePlayers = getEligiblePlayers(round, players);
  const spinsPerRound = LOOPS * eligiblePlayers.length;
  const maxSpins = round ? Math.min(round.games.length, spinsPerRound) : 0;
  const nextPlayerIndex = eligiblePlayers.length > 0 ? currentSpin % eligiblePlayers.length : 0;
  const nextPlayer = eligiblePlayers[nextPlayerIndex] ?? null;

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
    if (!round) return;

    const target = respinTargetRef.current;
    if (target) {
      await replaceAssignmentGame(target.id, game.id);
      const playerName = players.find((p) => p.id === target.playerId)?.name ?? 'Unknown';
      setAssignments((prev) =>
        prev.map((a) => (a.id === target.id ? { ...a, gameId: game.id, hit: undefined } : a))
      );
      setLastLanded({ game, playerName });
      setRespinTarget(null);
      respinTargetRef.current = null;
      return;
    }

    if (!nextPlayer) return;
    const newSpin = currentSpin + 1;
    const created = await createAssignment(round.id, game.id, nextPlayer.id, newSpin);
    const isComplete = newSpin >= maxSpins;
    const completedAt = isComplete ? new Date().toISOString() : undefined;
    await updateRoundSpin(round.id, newSpin, completedAt);
    setAssignments((prev) => [...prev, created]);
    setRound((prev) => (prev ? { ...prev, currentSpin: newSpin, completedAt } : null));
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

  const done = currentSpin >= maxSpins;

  const canSpin =
    role === 'host' &&
    !done &&
    !respinTarget &&
    !!nextPlayer &&
    eligiblePlayers.length > 0 &&
    remaining.length > 0 &&
    !spinning;

  const triggerSpin = () => {
    if (!canSpin) return;
    respinTargetRef.current = null;
    setRespinTarget(null);
    setSpinSignal((s) => s + 1);
  };

  const handleDeletePick = async (assignmentId: string) => {
    if (!round || role !== 'host') return;

    const nextAssignments = assignments.filter((a) => a.id !== assignmentId);
    await deleteAssignment(assignmentId);
    await rewindRoundSpin(round.id, nextAssignments.length);
    setAssignments(nextAssignments);
    setRound((prev) => (prev ? { ...prev, currentSpin: nextAssignments.length, completedAt: undefined } : null));

    if (respinTargetRef.current?.id === assignmentId) {
      respinTargetRef.current = null;
      setRespinTarget(null);
    }
  };

  const canEditEligiblePlayers = role === 'host' && assignments.length === 0 && !spinning && !respinTarget;
  const handleToggleEligiblePlayer = async (playerId: string) => {
    if (!round || !canEditEligiblePlayers || savingEligiblePlayers) return;

    const currentIds = eligiblePlayers.map((player) => player.id);
    const isIncluded = currentIds.includes(playerId);
    const nextIds = isIncluded
      ? currentIds.filter((id) => id !== playerId)
      : [...currentIds, playerId];

    if (nextIds.length === 0) {
      window.alert('Keep at least one player in the spin list.');
      return;
    }

    const orderedNextIds = players
      .filter((player) => nextIds.includes(player.id))
      .map((player) => player.id);

    setSavingEligiblePlayers(true);
    try {
      await updateRoundEligiblePlayers(round.id, orderedNextIds);
      setRound((prev) => (prev ? { ...prev, eligiblePlayerIds: orderedNextIds } : null));
    } finally {
      setSavingEligiblePlayers(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{round.name}</h1>
        <p className={styles.meta}>
          {respinTarget ? (
            <>
              Re-spinning {players.find((p) => p.id === respinTarget.playerId)?.name ?? ''}
            </>
          ) : (
            <>
              Spin {currentSpin} of {maxSpins}
              {players.length > 0 && ` · Players in spin: ${eligiblePlayers.length}/${players.length}`}
              {nextPlayer && !done && ` · Next: ${nextPlayer.name}`}
            </>
          )}
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
            disabled={eligiblePlayers.length === 0 || remaining.length === 0 || (!respinTarget && done)}
            onSpinningChange={setSpinning}
            spinSignal={spinSignal}
          />
        </div>
        <aside className={styles.infoCol}>
          <h2>Current spin</h2>
          {respinTarget ? (
            <>
              <div className={styles.currentPlayerCard}>
                <span className={styles.currentLabel}>{spinning ? 'Spinning for' : 'Re-spin for'}</span>
                <span className={styles.currentName}>
                  {players.find((p) => p.id === respinTarget.playerId)?.name ?? ''}
                </span>
              </div>
              <p className={styles.mutedSmall}>Remaining spreads on wheel: {remaining.length}</p>
              <p className={styles.mutedSmall}>
                {spinning ? 'Wheel is spinning…' : 'Pick another spread below to re-spin again.'}
              </p>
            </>
          ) : done || !nextPlayer ? (
            <p className={styles.muted}>Wheel is complete for this round.</p>
          ) : (
            <>
              <div className={styles.currentPlayerCard}>
                <span className={styles.currentLabel}>{spinning ? 'Spinning for' : 'Up next'}</span>
                <span className={styles.currentName}>{nextPlayer.name}</span>
              </div>
              <p className={styles.mutedSmall}>Remaining spreads on wheel: {remaining.length}</p>
              {role === 'host' && players.length > 0 && (
                <div className={styles.eligiblePlayers}>
                  <p className={styles.selectorTitle}>Players in this round</p>
                  <div className={styles.selectorList}>
                    {players.map((player) => {
                      const checked = eligiblePlayers.some((eligible) => eligible.id === player.id);
                      return (
                        <label key={player.id} className={styles.selectorItem}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEditEligiblePlayers || savingEligiblePlayers}
                            onChange={() => handleToggleEligiblePlayer(player.id)}
                          />
                          <span>{player.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {!canEditEligiblePlayers ? (
                    <p className={styles.selectorHelp}>Spin list locks after the first assignment.</p>
                  ) : (
                    <p className={styles.selectorHelp}>Uncheck anyone you want to skip this round.</p>
                  )}
                </div>
              )}
              {role === 'host' ? (
                <button type="button" className={styles.spinBtn} onClick={triggerSpin} disabled={!canSpin}>
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
                        <span key={a.id} className={styles.assignmentTagWrap}>
                          <span className={styles.assignmentTag}>{game.display}</span>
                          {role === 'host' && (
                            <>
                              <button
                                type="button"
                                className={[
                                  styles.respinBtn,
                                  respinTarget?.id === a.id ? styles.respinBtnActive : '',
                                ].join(' ')}
                                disabled={spinning}
                                onClick={() => {
                                  respinTargetRef.current = a;
                                  setRespinTarget(a);
                                  setSpinSignal((s) => s + 1);
                                }}
                              >
                                Re-spin
                              </button>
                              <button
                                type="button"
                                className={styles.deletePickBtn}
                                disabled={spinning}
                                onClick={() => handleDeletePick(a.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
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
