import { useEffect, useState } from 'react';

/** Current time in epoch ms, refreshed every `intervalMs`. For "Xs ago" labels. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "just now", "12s ago", "3 min ago", "2 h ago" */
export function formatAgo(elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 2) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
