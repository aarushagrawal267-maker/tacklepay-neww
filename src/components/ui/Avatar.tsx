import { initials } from "@/lib/format";
import type { Contact } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import { rem } from "@/lib/rem";

interface AvatarProps {
  name: string;
  color?: string;
  icon?: IconName;
  size?: number;
  ring?: boolean;
  /** "soft" = tinted tile with coloured initials (ledger style); "solid" = filled, for emphasis. */
  tone?: "soft" | "solid";
  className?: string;
}

/**
 * Rounded-square initials tile from the Tacket ledger: tinted background, coloured letters.
 * In dark mode the tint drops to neutral grey so the page stays black.
 */
export function Avatar({ name, color = "#5f6670", icon, size = 48, ring, tone = "soft", className = "" }: AvatarProps) {
  const radius = Math.round(size * 0.28);
  const style =
    tone === "solid"
      ? { width: rem(size), height: rem(size), borderRadius: rem(radius), background: color, color: "#fff", fontSize: rem(size * 0.36) }
      : ({ width: rem(size), height: rem(size), borderRadius: rem(radius), "--av": color, fontSize: rem(size * 0.34) } as React.CSSProperties);
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center font-medium ${
        tone === "soft" ? "bg-[color-mix(in_srgb,var(--av)_12%,white)] text-[var(--av)] dark:bg-surface-3 dark:text-[#d4d4d4]" : ""
      } ${ring ? "ring-2 ring-[var(--bg)]" : ""} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {icon ? <Icon name={icon} size={Math.round(size * 0.5)} /> : initials(name)}
    </span>
  );
}

export function ContactAvatar({ contact, size, ring, className }: { contact: Contact; size?: number; ring?: boolean; className?: string }) {
  return <Avatar name={contact.name} color={contact.color} icon={contact.icon} size={size} ring={ring} className={className} />;
}
