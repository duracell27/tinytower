import { useState, useEffect } from 'react';
import { clock } from '../services/clock';
import { useClockNow } from '../context/ClockContext';

export function useGameClock(intervalMs: number = 1000): number {
  const contextNow = useClockNow();
  const [localNow, setLocalNow] = useState(() => clock.now());

  useEffect(() => {
    if (intervalMs === 1000) return;
    const id = setInterval(() => setLocalNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return intervalMs === 1000 ? contextNow : localNow;
}
