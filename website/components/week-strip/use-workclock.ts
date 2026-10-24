'use client';
import { useEffect, useState } from 'react';

type Workclock = typeof import('workclock/web');

/** Loads the workclock WebAssembly module once the component mounts. */
export function useWorkclock() {
  const [workclock, setWorkclock] = useState<Workclock | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let cancelled = false;
    import('workclock/web')
      .then(async (mod) => {
        await mod.default();
        if (!cancelled) setWorkclock(mod);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { workclock, error };
}
