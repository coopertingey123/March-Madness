import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRounds, createRound } from '../lib/db';
import { useGame } from '../context/GameContext';
import type { Round } from '../types';
import styles from './Rounds.module.css';

function spreadDisplay(team: string, line: number) {
  return `${team} ${line >= 0 ? '+' : ''}${line}`;
}

const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

export default function Rounds() {
  const { currentGame, role } = useGame();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');
  const [spreadsText, setSpreadsText] = useState('');

  useEffect(() => {
    if (!currentGame) return;
    getRounds(currentGame.id).then((r) => {
      setRounds(r);
      setLoading(false);
    });
  }, [currentGame]);

  const parseSpreads = (text: string): { teamName: string; line: number; display: string }[] => {
    const lines = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const out: { teamName: string; line: number; display: string }[] = [];
    for (const line of lines) {
      const match = line.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?)\s*$/);
      if (match) {
        const teamName = match[1].trim();
        const lineNum = parseFloat(match[2]);
        out.push({ teamName, line: lineNum, display: spreadDisplay(teamName, lineNum) });
      }
    }
    return out;
  };

  const create = async () => {
    if (!currentGame) return;
    const name = newRoundName.trim() || ROUND_NAMES[rounds.length] || `Round ${rounds.length + 1}`;
    const spreads = parseSpreads(spreadsText);
    if (spreads.length === 0) {
      alert('Add at least one spread (e.g. "Montana +16.5" or "Kansas -12.5").');
      return;
    }
    setCreating(true);
    try {
      const round = await createRound(currentGame.id, name, rounds.length, spreads);
      setRounds((prev) => [...prev, round].sort((a, b) => a.order - b.order));
      setNewRoundName('');
      setSpreadsText('');
    } finally {
      setCreating(false);
    }
  };

  if (!currentGame) {
    return <p className={styles.loading}>Join or create a game first.</p>;
  }

  if (loading) return <p className={styles.loading}>Loading rounds…</p>;

  return (
    <div className={styles.page}>
      <h1>Rounds</h1>
      <p className={styles.sub}>Create a round and add Vegas spreads. One line per spread, e.g. Montana +16.5</p>

      {role === 'host' && (
        <section className={styles.create}>
          <h2>New round</h2>
          <input
            type="text"
            placeholder="Round name (e.g. Round of 64)"
            value={newRoundName}
            onChange={(e) => setNewRoundName(e.target.value)}
          />
          <textarea
            placeholder="One spread per line:&#10;Montana +16.5&#10;Kansas -12.5&#10;Colorado +6.5"
            value={spreadsText}
            onChange={(e) => setSpreadsText(e.target.value)}
            rows={8}
          />
          <button type="button" onClick={create} disabled={creating}>
            {creating ? 'Creating…' : 'Create round'}
          </button>
        </section>
      )}

      <section className={styles.list}>
        <h2>Rounds</h2>
        {rounds.length === 0 ? (
          <p className={styles.muted}>No rounds yet. Create one above.</p>
        ) : (
          <ul>
            {rounds.map((r) => (
              <li key={r.id} className={styles.roundRow}>
                <div>
                  <strong>{r.name}</strong>
                  <span className={styles.meta}>
                    {r.games.length} spreads · spin {r.currentSpin}
                    {r.completedAt ? ' · done' : ''}
                  </span>
                </div>
                <Link to={`/wheel/${r.id}`} className={styles.link}>Wheel</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
