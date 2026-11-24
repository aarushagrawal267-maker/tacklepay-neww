import { useId, type ComponentProps } from "react";

/** Material outlined text field with a floating label. */
export function Field({ label, hint, error, className = "", ...rest }: { label: string; hint?: string; error?: string } & ComponentProps<"input">) {
  const id = useId();
  const describedBy = error || hint ? `${id}-d` : undefined;
  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          placeholder=" "
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`peer h-14 w-full rounded-[0.625rem] border bg-surface px-4 pt-4 text-base text-text outline-none transition-colors focus:border-primary-fg focus:ring-3 focus:ring-primary-fg/15 ${
            error ? "border-danger" : "border-line"
          }`}
          {...rest}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-1/2 origin-left -translate-y-1/2 text-base text-text-2 transition-all peer-focus:top-3.5 peer-focus:text-xs peer-focus:text-primary-fg peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs"
        >
          {label}
        </label>
      </div>
      {(error || hint) && (
        <p id={describedBy} className={`mt-1 px-4 text-xs ${error ? "text-danger" : "text-text-2"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Underlined field used by the reference app's bank-transfer and recharge forms. */
export function LineField({ label, error, className = "", ...rest }: { label: string; error?: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-text-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-e` : undefined}
        className={`mt-1.5 h-12 w-full rounded-[0.625rem] border bg-surface px-3.5 text-base text-text outline-none placeholder:text-text-3 focus:border-primary-fg focus:ring-3 focus:ring-primary-fg/15 ${error ? "border-danger" : "border-line"}`}
        {...rest}
      />
      {error && (
        <p id={`${id}-e`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
