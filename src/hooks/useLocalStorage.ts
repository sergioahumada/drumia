import { useState, useCallback } from 'react';
import { Session } from '../types';

const STORAGE_KEY = 'drumia_sessions';

export function useLocalStorage() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const saveSession = useCallback((session: Session) => {
    setSessions((prev) => {
      const updated = [...prev];
      const index = updated.findIndex((s) => s.id === session.id);
      if (index >= 0) {
        updated[index] = session;
      } else {
        updated.push(session);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getSession = useCallback(
    (id: string) => {
      return sessions.find((s) => s.id === id);
    },
    [sessions]
  );

  return {
    sessions,
    saveSession,
    deleteSession,
    getSession,
  };
}
