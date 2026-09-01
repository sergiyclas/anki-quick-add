import type { Settings, UiThemeSetting } from "../lib/settings/schema";

export type UiTheme = UiThemeSetting;
export type Mode = "light" | "dark" | "system";

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// Dark between `from` and `until`; the range may cross midnight (e.g. 20:00 -> 07:00).
export function isDarkBySchedule(from: string, until: string, now: Date = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutes(from);
  const end = minutes(until);
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function effectiveMode(settings: Pick<Settings, "ui">, now: Date = new Date()): Mode {
  const { theme, themeSchedule } = settings.ui;
  if (theme === "schedule") return isDarkBySchedule(themeSchedule.darkFrom, themeSchedule.darkUntil, now) ? "dark" : "light";
  return theme;
}

// Sets data-theme on <html>; base.css resolves the tokens from it (and from prefers-color-scheme for "system").
export function applyUiTheme(settings: Pick<Settings, "ui">): void {
  const mode = effectiveMode(settings);
  if (mode === "system") delete document.documentElement.dataset["theme"];
  else document.documentElement.dataset["theme"] = mode;
}
