export type RoundId = string;
export type PlayerId = string;
export type GameId = string;
export type AssignmentId = string;

export type GameSessionId = string;

export type UserRole = 'host' | 'player';

export interface GameSession {
  id: GameSessionId;
  name: string;
  hostCode: string;
  createdAt: string;
}

export interface Player {
  id: PlayerId;
  name: string;
  order: number; // 1–10 for wheel order
}

export interface Spread {
  teamName: string;
  line: number; // e.g. +16.5 → 16.5, -12.5 → -12.5
  display: string; // e.g. "Montana +16.5", "Kansas -12.5"
}

export interface Game {
  id: GameId;
  roundId: RoundId;
  teamName: string;
  line: number;
  display: string;
  /** Final score diff from underdog POV: positive = underdog covered */
  result?: number; // set when game is finalized
}

export interface Assignment {
  id: AssignmentId;
  roundId: RoundId;
  gameId: GameId;
  playerId: PlayerId;
  spinOrder: number; // 1–30
  /** Resolved after game result: true = spread covered, player gets +1 */
  hit?: boolean;
}

export interface Round {
  id: RoundId;
  name: string; // e.g. "Round of 64", "Sweet 16"
  order: number;
  games: Game[];
  /** Player ids eligible to spin this round (defaults to all players when omitted). */
  eligiblePlayerIds?: PlayerId[];
  /** 1–30, current spin (0 = not started) */
  currentSpin: number;
  completedAt?: string; // ISO when wheel finished
}

export interface GameWithAssignment extends Game {
  assignment?: Assignment;
  playerName?: string;
}
