export type ToastKind = "info" | "ok" | "warn" | "err";

// Injected into the page: must be self-contained (no imports, no closures).
function showToastInPage(text: string, kind: ToastKind): void {
  const id = "aqa-toast";
  document.getElementById(id)?.remove();
  const colors: Record<string, string> = { info: "#374151", ok: "#1a7f37", warn: "#b26a00", err: "#c62828" };
  const el = document.createElement("div");
  el.id = id;
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "2147483647",
    right: "16px",
    bottom: "16px",
    maxWidth: "380px",
    padding: "10px 14px",
    borderRadius: "8px",
    font: "14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    color: "#fff",
    background: colors[kind] ?? colors["info"]!,
    boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    whiteSpace: "pre-line",
  });
  document.documentElement.appendChild(el);
  if (kind !== "info") setTimeout(() => el.remove(), 3500);
}

// Shows a toast on the tab; falls back to the action badge where scripts cannot run (chrome://, Web Store, PDFs).
export async function notify(tabId: number, text: string, kind: ToastKind): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: showToastInPage, args: [text, kind] });
  } catch {
    if (kind === "info") return;
    await chrome.action.setBadgeBackgroundColor({ color: kind === "ok" ? "#1a7f37" : "#c62828" });
    await chrome.action.setBadgeText({ text: kind === "ok" ? "✓" : "!" });
    setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 3000);
  }
}
