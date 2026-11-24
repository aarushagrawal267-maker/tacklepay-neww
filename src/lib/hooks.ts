"use client";
import { useMemo } from "react";
import { useStore } from "./store";
import type { Contact } from "./types";

export function useContact(id: string | undefined): Contact | undefined {
  return useStore((s) => s.contacts.find((c) => c.id === id));
}

/** People ordered by most recent activity, then the seed order — like the home "People" grid. */
export function useRecentPeople(): Contact[] {
  const contacts = useStore((s) => s.contacts);
  const transactions = useStore((s) => s.transactions);
  const messages = useStore((s) => s.messages);
  return useMemo(() => {
    const last = new Map<string, number>();
    for (const t of transactions) if (t.contactId) last.set(t.contactId, Math.max(last.get(t.contactId) ?? 0, t.at));
    for (const m of messages) last.set(m.contactId, Math.max(last.get(m.contactId) ?? 0, m.at));
    const people = contacts.filter((c) => c.kind === "person");
    return people
      .map((c, i) => ({ c, i, t: last.get(c.id) ?? 0 }))
      .sort((a, b) => b.t - a.t || a.i - b.i)
      .map((x) => x.c);
  }, [contacts, transactions, messages]);
}

export function useBusinesses(): Contact[] {
  const contacts = useStore((s) => s.contacts);
  return useMemo(() => contacts.filter((c) => c.kind === "business"), [contacts]);
}
