import React, { createContext, useContext, useEffect, useState } from 'react';
import type { GameSession, UserRole } from '../types';

interface GameContextValue {
  currentGame: GameSession | null;
  role: UserRole | null;
  setGame: (game: GameSession, role: UserRole) => void;
  clearGame: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

const STORAGE_KEY = 'mm_spread_wheel_game';

interface StoredGame {
  game: GameSession;
  role: UserRole;
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentGame, setCurrentGame] = useState<GameSession | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredGame;
      setCurrentGame(parsed.game);
      setRole(parsed.role);
    } catch {
      // ignore
    }
  }, []);

  const setGame = (game: GameSession, nextRole: UserRole) => {
    setCurrentGame(game);
    setRole(nextRole);
    const payload: StoredGame = { game, role: nextRole };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const clearGame = () => {
    setCurrentGame(null);
    setRole(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <GameContext.Provider value={{ currentGame, role, setGame, clearGame }}>
      {children}
    </GameContext.Provider>
  );
};

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}

