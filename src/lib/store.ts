"use client";
// The app's copy of the signed-in person's TPI books. The server is the source of truth; this
// copy is cached in localStorage so screens paint instantly, and `applySnapshot` replaces it
// after every sync or change. Only the theme is purely local.
import { useSyncExternalStore } from "react";
import { initialState } from "./seed";
import type { Snapshot } from "./tpi";
import type { State } from "./types";

const KEY = "tacketpay:v2";
const LEGACY_KEY = "tacketpay:v1";
const SERVER_STATE = initialState();

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return SERVER_STATE;
  try {
    // Balances used to live only on the phone; they now come from TPI, so the old copy is dropped.
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed?.version === 2 && Array.isArray(parsed.accounts)) return parsed;
    }
  } catch (err) {
    console.warn("[tacketpay] Could not read the saved copy, waiting for TPI.", err);
  }
  return initialState();
}

function current(): State {
  if (!state) state = load();
  return state;
}

function persist(next: State) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    // Private mode or full storage: the app keeps working, it just re-downloads on the next visit.
    console.warn("[tacketpay] Could not cache data on this device.", err);
  }
}

export function getState(): State {
  return current();
}

export function setState(update: (s: State) => State) {
  const next = update(current());
  if (next === state) return;
  state = next;
  persist(next);
  listeners.forEach((l) => l());
}

/** Replaces everything the server owns with its latest snapshot. */
export function applySnapshot(snap: Snapshot) {
  setState((s) => {
    const known = new Set(snap.contacts.map((c) => c.handle));
    // A bank payee you've typed in but not paid yet exists only on this device until the first transfer.
    const typedIn = s.contacts.filter((c) => c.kind === "bank" && !known.has(c.handle));
    return {
      ...s,
      onboarded: true,
      rev: snap.rev,
      profile: { name: snap.me.name, handle: snap.me.handle, phone: snap.me.phone },
      referralCode: snap.me.referralCode,
      accounts: snap.accounts,
      cards: snap.cards,
      contacts: [...snap.contacts, ...typedIn],
      messages: snap.messages,
      transactions: snap.transactions,
      rewards: snap.rewards,
      linkedBills: snap.linkedBills,
    };
  });
}

/** Forgets the cached copy (sign out, or the session expired). The theme stays. */
export function clearLocal() {
  setState((s) => (s.onboarded || s.rev ? { ...initialState(), theme: s.theme } : s));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    // Keep multiple tabs in sync.
    if (e.key === KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Select a slice. The selector must return something already in state (no new objects). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(current()),
    () => selector(SERVER_STATE),
  );
}

const noopSubscribe = () => () => {};
/** False during prerender and hydration, true once we are reading the real device state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
