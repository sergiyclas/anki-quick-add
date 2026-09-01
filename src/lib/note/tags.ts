import type { Settings } from "../settings/schema";

export const MARKER_TAG = "aqa";

export function buildTags(settings: Settings, extra: string[] = []): string[] {
  const tags = new Set<string>([...settings.anki.tags, ...extra].map((t) => t.trim()).filter(Boolean));
  tags.add(MARKER_TAG);
  if (settings.anki.autoLangTag) tags.add(`${settings.languages.source}-${settings.languages.target}`);
  return [...tags];
}
