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
          // Floats by transform only (translate + scale), never by animating top or font-size.
          className="pointer-events-none absolute left-4 top-4 origin-top-left text-base leading-6 text-text-2 transition-[translate,scale,color] duration-150 ease-[var(--ease-out)] peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-primary-fg peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
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
