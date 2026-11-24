import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

interface RowProps {
  icon?: IconName;
  label: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

/** settingItem() from the reference app: 30px leading icon, label, optional chevron. */
export function ListRow({ icon, label, detail, trailing, href, onClick, danger }: RowProps) {
  const body = (
    <>
      {icon && (
        <span className={`grid size-9 shrink-0 place-items-center rounded-[0.625rem] ${danger ? "bg-danger-soft text-danger" : "bg-surface-3 text-text-2"}`}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[0.9375rem] ${danger ? "text-danger" : "text-text"}`}>{label}</span>
        {detail && <span className="mt-0.5 block truncate text-[0.8125rem] text-text-2">{detail}</span>}
      </span>
      {trailing ?? (href ? <Icon name="chevron_right" className="text-text-2" /> : null)}
    </>
  );
  const cls = "press flex min-h-[3.75rem] w-full items-center gap-4 px-5 py-2.5 text-left";
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-5 pb-1 pt-6 text-[0.8125rem] font-medium text-text-3">{children}</h2>;
}
