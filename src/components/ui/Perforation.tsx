/**
 * Tacket's stub edge: a dashed tear line with a half-round notch cut into each side, like the
 * perforation on a ticket stub or a carbon-copy receipt. It marks the line where money settles
 * (receipt, confirm sheet, balance card) and nowhere else.
 *
 * Put it directly inside a card that has `overflow-hidden` and a 1px border (or none); the card
 * clips the outer half of each notch. Set `--notch` on an ancestor when the card sits on something
 * other than `--bg`, such as a sheet (`[--notch:var(--surface)]`).
 */
export function Perforation({ className = "" }: { className?: string }) {
  return (
    <div className={`perforation ${className}`} aria-hidden="true">
      <span className="dashed flex-1" />
    </div>
  );
}
