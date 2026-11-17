import { useState, useEffect } from 'react';

// Each caller gets its own independent setInterval — NO ClockContext subscription.
// This prevents the "all consumers re-render simultaneously" problem that caused
// 300ms JS-thread blocks every second when multiple screens were mounted.
export function useGameClock(intervalMs: number = 1000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
