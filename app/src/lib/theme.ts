import { useEffect, useState } from "react";

export type ThemeChoice = "dark" | "light" | "system";

const KEY = "kader.theme.v1";

/** Runs before paint (inlined in <head>) so the first frame is never the wrong
 *  theme. Keep it dependency-free and small — it is shipped as a string. */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem("${KEY}")||"dark";var d=c==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):c;document.documentElement.setAttribute("data-theme",d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

/** Dark is the studio's default look; "system" is opt-in from settings. */
export function readThemeChoice(): ThemeChoice {
  if (typeof localStorage === "undefined") return "dark";
  const raw = localStorage.getItem(KEY);
  return raw === "dark" || raw === "light" || raw === "system" ? raw : "dark";
}

export function resolveTheme(choice: ThemeChoice): "dark" | "light" {
  if (choice !== "system") return choice;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  // Keep the Android/Chrome browser chrome in step with the app shell.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#efeade" : "#0a0b10");
}

export function saveThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode — the session still themes correctly, it just won't persist */
  }
  applyTheme(choice);
}

/** Theme choice + live resolution, kept in sync with the OS while on "system". */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const initial = readThemeChoice();
    setChoice(initial);
    setResolved(resolveTheme(initial));
    applyTheme(initial);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (readThemeChoice() !== "system") return;
      applyTheme("system");
      setResolved(resolveTheme("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function set(next: ThemeChoice) {
    setChoice(next);
    setResolved(resolveTheme(next));
    saveThemeChoice(next);
  }

  return { choice, resolved, set };
}
