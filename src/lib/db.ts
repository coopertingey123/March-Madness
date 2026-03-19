import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteField,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Player, Round, Game, Assignment, GameSession } from '../types';

const GAMES = 'games';
const PLAYERS = 'players';
const ROUNDS = 'rounds';
const ASSIGNMENTS = 'assignments';

// ——— Games (sessions) ———

function generateHostCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGame(name: string): Promise<GameSession> {
  const hostCode = generateHostCode();
  const createdAt = new Date().toISOString();
  const ref = await addDoc(collection(db, GAMES), {
    name,
    hostCode,
    createdAt,
  });
  return { id: ref.id, name, hostCode, createdAt };
}

export async function getGameByCode(code: string): Promise<GameSession | null> {
  const snap = await getDocs(
    query(collection(db, GAMES), where('hostCode', '==', code.trim().toUpperCase()))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as { name: string; hostCode: string; createdAt: string };
  return { id: d.id, ...data };
}

export async function getGame(gameId: string): Promise<GameSession | null> {
  const d = await getDoc(doc(db, GAMES, gameId));
  if (!d.exists()) return null;
  const data = d.data() as { name: string; hostCode: string; createdAt: string };
  return { id: d.id, ...data };
}

// ——— Players ———
export async function getPlayers(gameId: string): Promise<Player[]> {
  const snap = await getDocs(
    query(collection(db, PLAYERS), where('gameId', '==', gameId))
  );
  const players = snap.docs.map(
    (d: { id: string; data: () => Record<string, unknown> }) =>
      ({ id: d.id, ...d.data() } as Player)
  );
  return players.sort((a: Player, b: Player) => a.order - b.order);
}

export async function setPlayer(gameId: string, player: Player): Promise<void> {
  await setDoc(doc(db, PLAYERS, player.id), { ...player, gameId });
}

export async function addPlayer(gameId: string, name: string, order: number): Promise<Player> {
  const ref = await addDoc(collection(db, PLAYERS), { name, order, gameId });
  return { id: ref.id, name, order };
}

export async function deletePlayer(id: string): Promise<void> {
  await deleteDoc(doc(db, PLAYERS, id));
}

// ——— Rounds ———
export async function getRounds(gameId: string): Promise<Round[]> {
  const snap = await getDocs(
    query(collection(db, ROUNDS), where('gameId', '==', gameId))
  );
  const rounds = snap.docs.map((d: { id: string; data: () => Record<string, unknown> }) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      order: data.order,
      games: data.games ?? [],
      currentSpin: data.currentSpin ?? 0,
      completedAt: data.completedAt ?? undefined,
    } as Round;
  });
  return rounds.sort((a: Round, b: Round) => a.order - b.order);
}

export async function getRound(roundId: string): Promise<Round | null> {
  const d = await getDoc(doc(db, ROUNDS, roundId));
  if (!d.exists()) return null;
  const data = d.data();
  return {
    id: d.id,
    name: data.name,
    order: data.order,
    games: data.games ?? [],
    currentSpin: data.currentSpin ?? 0,
    completedAt: data.completedAt ?? undefined,
  } as Round;
}

export async function createRound(gameId: string, name: string, order: number, spreads: { teamName: string; line: number; display: string }[]): Promise<Round> {
  const roundRef = doc(collection(db, ROUNDS));
  const roundId = roundRef.id;
  const games: Game[] = spreads.map((s, i) => ({
    id: `game_${roundId}_${i}`,
    roundId,
    teamName: s.teamName,
    line: s.line,
    display: s.display,
  }));
  await setDoc(roundRef, {
    gameId,
    name,
    order,
    // Do not include undefined fields (Firestore rejects undefined), so we omit result here.
    games: games.map((g) => ({ id: g.id, teamName: g.teamName, line: g.line, display: g.display })),
    currentSpin: 0,
  });
  return { id: roundId, name, order, games, currentSpin: 0 };
}

export async function updateRoundSpin(roundId: string, currentSpin: number, completedAt?: string): Promise<void> {
  const payload: Record<string, unknown> = { currentSpin };
  if (completedAt != null) payload.completedAt = completedAt;
  await updateDoc(doc(db, ROUNDS, roundId), payload);
}

/** Compute total score for a player across all rounds (assignments where hit === true). */
export async function getPlayerScores(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, ASSIGNMENTS));
  const scores: Record<string, number> = {};
  snap.docs.forEach((d: { data: () => Record<string, unknown> }) => {
    const a = d.data();
    if (a.hit === true && typeof a.playerId === 'string') scores[a.playerId] = (scores[a.playerId] ?? 0) + 1;
  });
  return scores;
}

// ——— Games (stored inside round doc for simplicity; we also mirror to games collection for queries)
export async function getGamesForRound(roundId: string): Promise<Game[]> {
  const r = await getRound(roundId);
  if (!r) return [];
  return r.games.map((g) => ({ ...g, roundId }));
}

// ——— Assignments ———
export async function getAssignmentsForRound(roundId: string): Promise<Assignment[]> {
  const snap = await getDocs(
    query(collection(db, ASSIGNMENTS), where('roundId', '==', roundId))
  );
  const assignments = snap.docs.map(
    (d: { id: string; data: () => Record<string, unknown> }) =>
      ({ id: d.id, ...d.data() } as Assignment)
  );
  return assignments.sort((a: Assignment, b: Assignment) => a.spinOrder - b.spinOrder);
}

export async function createAssignment(roundId: string, gameId: string, playerId: string, spinOrder: number): Promise<Assignment> {
  const ref = await addDoc(collection(db, ASSIGNMENTS), {
    roundId,
    gameId,
    playerId,
    spinOrder,
  });
  return { id: ref.id, roundId, gameId, playerId, spinOrder };
}

export async function replaceAssignmentGame(assignmentId: string, newGameId: string): Promise<void> {
  // Assignment now points at a different spread, so any previously-set outcome is no longer valid.
  await updateDoc(doc(db, ASSIGNMENTS, assignmentId), { gameId: newGameId, hit: deleteField() });
}

export async function setAssignmentHit(assignmentId: string, hit: boolean): Promise<void> {
  await updateDoc(doc(db, ASSIGNMENTS, assignmentId), { hit });
}

export async function createAssignmentsBatch(roundId: string, pairs: { gameId: string; playerId: string }[], spinOrderStart: number): Promise<void> {
  const batch = writeBatch(db);
  const coll = collection(db, ASSIGNMENTS);
  pairs.forEach((p, i) => {
    const ref = doc(coll);
    batch.set(ref, {
      roundId,
      gameId: p.gameId,
      playerId: p.playerId,
      spinOrder: spinOrderStart + i,
    });
  });
  await batch.commit();
}

// ——— Helpers for wheel: get remaining games (not yet assigned) for round
export function getRemainingGames(round: Round, assignments: Assignment[]): Game[] {
  const assigned = new Set(assignments.map((a) => a.gameId));
  return round.games.filter((g) => !assigned.has(g.id));
}

export function getRemainingGamesForRespin(round: Round, assignments: Assignment[], targetAssignmentId: string): Game[] {
  // While respinning a specific assignment, we should exclude all other already-assigned games,
  // but allow the current game for the target assignment to appear as a segment.
  const assigned = new Set(assignments.filter((a) => a.id !== targetAssignmentId).map((a) => a.gameId));
  return round.games.filter((g) => !assigned.has(g.id));
}
