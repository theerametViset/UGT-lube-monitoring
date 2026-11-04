// Text colour from a data/status hue (chart series, status, category colours).
// Those hues are tuned for fills and fail contrast as text (green #22c55e is
// 2.3:1 on white). Mixing 55% of the hue with the theme's main text colour keeps
// the hue recognisable and gives ≥4.5:1 in both themes: it darkens on the light
// theme and lightens on the dark one, because --c-t1 flips with the theme.
export function readableText(color: string): string {
  return `color-mix(in srgb, ${color} 55%, rgb(var(--c-t1)))`;
}
