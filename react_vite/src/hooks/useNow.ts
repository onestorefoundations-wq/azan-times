import { useEffect, useState } from 'react';

/** Ticks `now` every [intervalMs] (default 1s) for live clocks/countdowns. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
