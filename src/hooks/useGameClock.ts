import { useState, useEffect } from 'react';
import { clock } from '../services/clock';

export function useGameClock(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
