// Runtime host permissions for user-entered hosts (custom AnkiConnect URL, OpenAI-compatible base URL).
// Default hosts are declared statically in the manifest; anything else must be granted from a user gesture.

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

export function hasOrigin(pattern: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [pattern] });
}

// Must be called synchronously from a click handler (Chrome requires a user gesture).
export function requestOrigin(pattern: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [pattern] });
}
