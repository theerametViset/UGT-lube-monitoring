// Next re-renders the route after a save (revalidatePath / router.refresh) and that
// remounts Data Entry, which wiped what the user needs to see right then: the save
// notice, the "next machine" hand-off, the WO form, the Batch import's leftover rows.
// The screen arms a carry just before the refresh; a remounted instance reads it back.
// Module memory (not storage): it survives remounts but not a reload, and is never
// consumed on read — a dev StrictMode double-mount or a second refresh reads it again.
// It ends after TTL or as soon as the user acts (dropCarries on pointer/key input).

import { useEffect, useRef } from "react";

const TTL_MS = 20_000;
const EVENT = "remount-carry";
const store = new Map<string, { value: unknown; at: number }>();

export function armCarry(key: string, value: unknown): void {
  store.set(key, { value, at: Date.now() });
  // The remount can land before the arm (the server action's revalidation re-renders
  // while uploads are still running), so a freshly mounted instance listens for it too.
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function readCarry<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

/** Called on the user's next pointer/key input: from then on, state is theirs again. */
export function dropCarries(prefix: string): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** Apply a carried value on mount and whenever it is armed while this instance is mounted. */
export function useCarry<T>(key: string, apply: (value: T) => void): void {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    const v = readCarry<T>(key);
    if (v !== undefined) applyRef.current(v);
    const onArm = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== key) return;
      const next = readCarry<T>(key);
      if (next !== undefined) applyRef.current(next);
    };
    window.addEventListener(EVENT, onArm);
    return () => window.removeEventListener(EVENT, onArm);
  }, [key]);
}
