import { useEffect, useState } from "preact/hooks";
import { type HistoryEntry, loadHistory } from "../lib/history";

export function History() {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    loadHistory().then(setItems);
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes["history"]) setItems((changes["history"].newValue as HistoryEntry[] | undefined) ?? []);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!items.length) return null;
  return (
    <div class="popup-history">
      {items.slice(0, 5).map((h) => (
        <div key={h.noteId} title={h.deck}>
          {h.word} – {h.translation}
        </div>
      ))}
    </div>
  );
}
