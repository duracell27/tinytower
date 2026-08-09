import React, { createContext, useContext, useState, useEffect } from 'react';
import { clock } from '../services/clock';

const ClockContext = createContext<number>(0);

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function useClockNow(): number {
  return useContext(ClockContext);
}
