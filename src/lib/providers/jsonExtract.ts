import { ProviderError } from "./types";

// Parses a JSON object from model text, tolerating ``` fences and surrounding prose.
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new ProviderError("empty", "The model returned an empty response");
  const candidates = [trimmed, trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new ProviderError("invalid_json", `The model did not return valid JSON: ${trimmed.slice(0, 120)}`);
}
