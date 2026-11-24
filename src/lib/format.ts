const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long" });
const dateYearFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export function formatDay(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return "Today";
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.getFullYear() === n.getFullYear() ? dateFmt.format(d) : dateYearFmt.format(d);
}

export function formatTime(ts: number): string {
  return timeFmt.format(new Date(ts));
}

export function formatShort(ts: number): string {
  return shortFmt.format(new Date(ts));
}

export function formatFull(ts: number): string {
  return `${dateYearFmt.format(new Date(ts))}, ${timeFmt.format(new Date(ts))}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function groupRef(ref: string): string {
  return ref.replace(/(\d{4})(?=\d)/g, "$1 ");
}
