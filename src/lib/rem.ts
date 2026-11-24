/** Design pixels (at the 390px reference width) → rem, so sizes follow the fluid root font size. */
export function rem(px: number): string {
  return `${+(px / 16).toFixed(4)}rem`;
}
