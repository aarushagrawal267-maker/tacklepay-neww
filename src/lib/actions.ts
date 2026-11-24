// Small pure helpers over the app's copy of the books. The money rules themselves (paying,
// top-ups, rewards, limits) run on the server in `src/server/tpi`, where both sides of a payment live.
import { colorFor } from "./seed";
import { TPI_ERROR_COPY } from "./tpi";
import type { Account, Contact, ContactKind, State, ThemePref } from "./types";

/** Copy for the checks the app makes before calling TPI (the server repeats them). */
export const ERROR_COPY = TPI_ERROR_COPY;

export function primaryAccount(state: Pick<State, "accounts">): Account | undefined {
  return state.accounts.find((a) => a.primary) ?? state.accounts[0];
}

export function totalBalance(state: State): number {
  return state.accounts.reduce((sum, a) => sum + a.balance, 0);
}

/** Finds a contact by handle, or adds one this device knows about (a bank payee before the first transfer). */
export function ensureContact(
  state: State,
  input: { id: string; name: string; handle: string; kind: ContactKind; subtitle?: string; color?: string },
): { state: State; contact: Contact } {
  const existing = state.contacts.find((c) => c.handle === input.handle);
  if (existing) return { state, contact: existing };
  const contact: Contact = {
    id: input.id,
    name: input.name.trim().slice(0, 40) || input.handle.split("@")[0],
    handle: input.handle,
    kind: input.kind,
    subtitle: input.subtitle,
    color: input.color ?? colorFor(input.handle),
  };
  return { state: { ...state, contacts: [...state.contacts, contact] }, contact };
}

export function setTheme(state: State, theme: ThemePref): State {
  return { ...state, theme };
}
