export const COMIC_FONTS = [
  { v: "Vazirmatn, Tahoma, sans-serif", n: "وزیر" },
  { v: "Tahoma, sans-serif", n: "تاهوما" },
  { v: '"Segoe UI", system-ui, sans-serif', n: "سگو" },
  { v: "Georgia, serif", n: "جورجیا" },
  { v: '"IBM Plex Mono", ui-monospace, monospace', n: "مونو" },
  { v: "Impact, Haettenschweiler, sans-serif", n: "ایمپکت" },
] as const;

export function fontString(it: {
  italic?: boolean;
  bold?: boolean;
  font?: number;
  fontFamily?: string;
}) {
  const style = it.italic ? "italic" : "normal";
  const weight = it.bold ? 700 : 500;
  const size = it.font ?? 28;
  const family = it.fontFamily || COMIC_FONTS[0].v;
  return `${style} ${weight} ${size}px ${family}`;
}
