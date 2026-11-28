import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "filled" | "outlined" | "tonal" | "text" | "white";

const base =
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.625rem] font-medium transition-[background,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40";

// Primary is flat brand blue with no gloss or glow; outlined is the white secondary button,
// which turns into a borderless dark chip in dark mode.
const variants: Record<Variant, string> = {
  filled: "bg-primary text-primary-ink",
  outlined: "border border-button-line bg-button text-text shadow-e1",
  tonal: "bg-primary-soft text-primary-fg",
  text: "text-primary-fg",
  white: "bg-white text-[#0b0d10]",
};

const sizes = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

interface Common {
  variant?: Variant;
  size?: keyof typeof sizes;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = "filled", size = "md", icon, block, className = "", children, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${sizes[size]} ${block ? "w-full" : ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={19} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "filled", size = "md", icon, block, className = "", children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={`${base} ${variants[variant]} ${sizes[size]} ${block ? "w-full" : ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={19} />}
      {children}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  size = 24,
  filled,
  ...rest
}: { icon: IconName; label: string; size?: number; filled?: boolean } & ComponentProps<"button">) {
  return (
    <button type="button" aria-label={label} title={label} className={`press grid size-11 shrink-0 place-items-center rounded-[0.625rem] ${className}`} {...rest}>
      <Icon name={icon} size={size} filled={filled} />
    </button>
  );
}
