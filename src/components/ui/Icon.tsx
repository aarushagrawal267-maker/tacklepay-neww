import { ICON_PATHS, type IconName } from "./icon-paths";
import { rem } from "@/lib/rem";

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
  /** Pass a label only when the icon carries meaning on its own. */
  label?: string;
}

export function Icon({ name, size = 24, filled = false, className, label }: IconProps) {
  const key = (filled ? `${name}-fill` : name) as keyof typeof ICON_PATHS;
  return (
    <svg
      viewBox="0 -960 960 960"
      style={{ width: rem(size), height: rem(size) }}
      fill="currentColor"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={ICON_PATHS[key] ?? ICON_PATHS[name]} />
    </svg>
  );
}
