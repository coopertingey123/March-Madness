import { useState, useEffect } from 'react';
import { getPlayers, setPlayer, addPlayer, deletePlayer } from '../lib/db';
import { useGame } from '../context/GameContext';
import type { Player } from '../types';
import styles from './Players.module.css';

export default function Players() {
  const { currentGame } = useGame();
  const [players, setPlayersState] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!currentGame) return;
    getPlayers(currentGame.id).then((p) => {
      setPlayersState(p);
      setLoading(false);
    });
  }, [currentGame]);

  const add = async () => {
    if (!currentGame) return;
    const name = newName.trim();
    if (!name) return;
    const nextOrder = players.length + 1;
    const p = await addPlayer(currentGame.id, name, nextOrder);
    setPlayersState((prev) => [...prev, p].sort((a, b) => a.order - b.order));
    setNewName('');
  };

  const remove = async (id: string) => {
    if (!currentGame) return;
    await deletePlayer(id);
    const remaining = players.filter((p) => p.id !== id);
    setPlayersState(remaining);
    for (let i = 0; i < remaining.length; i++) {
      await setPlayer(currentGame.id, { ...remaining[i], order: i + 1 });
    }
    setPlayersState(await getPlayers(currentGame.id));
  };

  const startEdit = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const p = players.find((x) => x.id === editingId);
    if (!p) return;
    if (!currentGame) return;
    await setPlayer(currentGame.id, { ...p, name: editName.trim() || p.name });
    setPlayersState(await getPlayers(currentGame.id));
    setEditingId(null);
    setEditName('');
  };

  if (!currentGame) {
    return <p className={styles.loading}>Join or create a game first.</p>;
  }

  if (loading) return <p className={styles.loading}>Loading players…</p>;

  return (
    <div className={styles.page}>
      <h1>Players</h1>
      <p className={styles.sub}>Add up to 10 players. Order is the wheel order (1 = first spin, etc.).</p>

      <div className={styles.addRow}>
        <input
          type="text"
          placeholder="Player name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" onClick={add} disabled={players.length >= 10}>
          Add
        </button>
      </div>

      <ul className={styles.list}>
        {players.map((p) => (
          <li key={p.id} className={styles.item}>
            <span className={styles.order}>{p.order}</span>
            {editingId === p.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
                <button type="button" onClick={saveEdit}>Save</button>
              </>
            ) : (
              <>
                <span className={styles.name}>{p.name}</span>
                <button type="button" className={styles.small} onClick={() => startEdit(p)}>Edit</button>
                <button type="button" className={styles.small} onClick={() => remove(p.id)}>Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>
      {players.length >= 10 && <p className={styles.muted}>Max 10 players.</p>}
    </div>
  );
}
