// Selection bubble: select text on a page -> instant translation + "Add to Anki" / "Edit…".
// Runs in the page as a dynamically registered content script. Deliberately self-contained (no imports),
// because content scripts cannot load ES-module chunks; the build verifies this (scripts/verify-dist.mjs).
// Everything lives inside one IIFE so a second injection into the same frame (registered script + manual
// injection into already-open tabs) exits early instead of running twice.

declare global {
  interface Window {
    __aqaBubbleLoaded?: boolean;
  }
}

(() => {
  if (window.__aqaBubbleLoaded) return;
  window.__aqaBubbleLoaded = true;

  type AddResult =
    | { status: "added" | "updated"; word: string; summary: { translation: string }; warnings: string[] }
    | { status: "duplicate"; word: string }
    | { status: "queued"; word: string; queued: number }
    | { status: "error"; word: string; message: string; action?: string };
  type Trigger = "always" | "shift" | "alt";

  const MAX_LEN = 200;
  const HOST_ID = "aqa-bubble-host";
  const STRING_KEYS = ["bubble_add", "bubble_edit", "bubble_no_translation", "popup_adding", "popup_added", "popup_duplicate", "popup_queued"];
  let strings: Record<string, string> = {};
  const msg = (key: string, subs: string[] = []) => {
    const template = strings[key] ?? chrome.i18n.getMessage(key, subs.length ? ["$1", "$2"] : undefined) ?? key;
    return template.replace(/\$(\d)/g, (_, i: string) => subs[Number(i) - 1] ?? "");
  };
  const loadStrings = () =>
    chrome.runtime.sendMessage({ type: "i18n.strings", keys: STRING_KEYS }, (r?: { ok: boolean; strings?: Record<string, string> }) => {
      if (r?.ok && r.strings) strings = r.strings;
    });
  loadStrings();

  type UiTheme = { theme?: "system" | "light" | "dark" | "schedule"; themeSchedule?: { darkFrom: string; darkUntil: string } };
  let uiTheme: UiTheme = {};
  function isDarkBySchedule(from: string, until: string): boolean {
    const toMin = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1] ?? 0);
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const a = toMin(from);
    const b = toMin(until);
    if (a === b) return false;
    return a < b ? cur >= a && cur < b : cur >= a || cur < b;
  }
  function isDark(): boolean {
    switch (uiTheme.theme ?? "system") {
      case "dark":
        return true;
      case "light":
        return false;
      case "schedule":
        return isDarkBySchedule(uiTheme.themeSchedule?.darkFrom ?? "20:00", uiTheme.themeSchedule?.darkUntil ?? "07:00");
      default:
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  }

  let host: HTMLDivElement | null = null;
  let currentText = "";
  let requestSeq = 0;
  let trigger: Trigger = "shift";

  function readTrigger(settings: unknown): Trigger {
    const value = (settings as { ui?: { bubbleTrigger?: Trigger } } | undefined)?.ui?.bubbleTrigger;
    return value === "always" || value === "alt" ? value : "shift";
  }
  function readTheme(settings: unknown): UiTheme {
    const ui = (settings as { ui?: UiTheme } | undefined)?.ui;
    return { theme: ui?.theme, themeSchedule: ui?.themeSchedule };
  }
  chrome.storage.sync.get("settings").then((s) => {
    trigger = readTrigger(s["settings"]);
    uiTheme = readTheme(s["settings"]);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes["settings"]) {
      trigger = readTrigger(changes["settings"].newValue);
      uiTheme = readTheme(changes["settings"].newValue);
      loadStrings();
    }
  });

  function modifierHeld(e: MouseEvent): boolean {
    return trigger === "always" || (trigger === "shift" && e.shiftKey) || (trigger === "alt" && e.altKey);
  }

  const STYLE = `
:host { all: initial; }
.bubble { position: fixed; z-index: 2147483647; max-width: 340px; min-width: 200px; padding: 10px 12px;
  border-radius: 10px; background: #fff; color: #1f2328; border: 1px solid #d0d7de; box-shadow: 0 6px 24px rgba(0,0,0,.18);
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.bubble.dark { background: #1e1f22; color: #e6e6e6; border-color: #3c3f44; }
.src { font-weight: 600; word-break: break-word; }
.tr { margin-top: 4px; color: #4a7bd0; word-break: break-word; min-height: 1.4em; }
.row { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
button { font: inherit; font-size: 13px; padding: 5px 10px; border-radius: 6px; cursor: pointer; border: 1px solid #4a7bd0; background: #4a7bd0; color: #fff; }
button.secondary { background: transparent; color: #4a7bd0; }
button:disabled { opacity: .6; cursor: default; }
.status { margin-top: 6px; font-size: 12px; min-height: 1.2em; }
.ok { color: #1a7f37; } .warn { color: #b26a00; } .err { color: #c62828; } .muted { color: #6b7280; }
`;

  function blockTextAround(node: Node | null): string {
    let el: Element | null = node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node?.parentElement ?? null);
    const BLOCK = /^(P|LI|DIV|TD|TH|BLOCKQUOTE|H[1-6]|ARTICLE|SECTION|DD|DT|PRE|FIGCAPTION|CAPTION|BODY)$/;
    while (el && !BLOCK.test(el.tagName)) el = el.parentElement;
    return (el?.textContent ?? "").slice(0, 4000);
  }

  function hide(): void {
    host?.remove();
    host = null;
    currentText = "";
  }

  function isEditable(node: Node | null): boolean {
    const el = node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
    return Boolean(el?.closest("input, textarea, [contenteditable]:not([contenteditable='false'])"));
  }

  function show(text: string, rect: DOMRect, block: string): void {
    hide();
    currentText = text;
    host = document.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const bubble = document.createElement("div");
    bubble.className = isDark() ? "bubble dark" : "bubble";
    bubble.innerHTML = `<div class="src"></div><div class="tr muted">…</div>
    <div class="row"><button class="add"></button><button class="secondary edit"></button></div><div class="status"></div>`;
    root.append(style, bubble);
    document.documentElement.appendChild(host);

    const src = bubble.querySelector<HTMLDivElement>(".src")!;
    const tr = bubble.querySelector<HTMLDivElement>(".tr")!;
    const addBtn = bubble.querySelector<HTMLButtonElement>(".add")!;
    const editBtn = bubble.querySelector<HTMLButtonElement>(".edit")!;
    const status = bubble.querySelector<HTMLDivElement>(".status")!;
    src.textContent = text;
    addBtn.textContent = msg("bubble_add");
    editBtn.textContent = msg("bubble_edit");

    // Position below the selection, flipped above when there is no room; clamped horizontally.
    const margin = 8;
    const width = Math.min(340, window.innerWidth - 2 * margin);
    let left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    let top = rect.bottom + margin;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    requestAnimationFrame(() => {
      const h = bubble.offsetHeight;
      if (top + h > window.innerHeight - margin) top = Math.max(margin, rect.top - h - margin);
      left = Math.max(margin, Math.min(left, window.innerWidth - bubble.offsetWidth - margin));
      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    });

    const seq = ++requestSeq;
    chrome.runtime.sendMessage({ type: "translate.quick", text }, (r?: { ok: boolean; translation?: string; error?: string }) => {
      if (seq !== requestSeq || !host) return;
      tr.classList.remove("muted");
      if (r?.ok && r.translation) tr.textContent = r.translation;
      else {
        tr.classList.add("muted");
        tr.textContent = msg("bubble_no_translation");
      }
    });

    addBtn.addEventListener("click", () => {
      addBtn.disabled = true;
      editBtn.disabled = true;
      status.className = "status muted";
      status.textContent = msg("popup_adding", [text]);
      chrome.runtime.sendMessage({ type: "add", word: text, block }, (r?: { ok: boolean; result?: AddResult; error?: string }) => {
        if (!host) return;
        const result = r?.ok && r.result ? r.result : null;
        if (!result) {
          status.className = "status err";
          status.textContent = r?.error ?? "error";
          addBtn.disabled = false;
          editBtn.disabled = false;
          return;
        }
        if (result.status === "added" || result.status === "updated") {
          status.className = "status ok";
          status.textContent =
            msg("popup_added", [result.word, result.summary.translation]) + (result.warnings.length ? ` (${result.warnings.join(", ")})` : "");
          setTimeout(() => host && hide(), 2500);
        } else if (result.status === "queued") {
          status.className = "status warn";
          status.textContent = msg("popup_queued", [result.word, String(result.queued)]);
          setTimeout(() => host && hide(), 2500);
        } else if (result.status === "duplicate") {
          status.className = "status warn";
          status.textContent = msg("popup_duplicate", [result.word]);
          editBtn.disabled = false;
        } else if (result.status === "error") {
          status.className = "status err";
          status.textContent = result.message;
          addBtn.disabled = false;
          editBtn.disabled = false;
        }
      });
    });

    editBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "editor.open", word: text, block });
      hide();
    });
  }

  function onSelectionSettled(): void {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!sel || sel.rangeCount === 0 || !text || text.length > MAX_LEN || isEditable(sel.anchorNode)) {
      if (!text) hide();
      return;
    }
    if (text === currentText && host) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    show(text, rect, blockTextAround(sel.anchorNode));
  }

  document.addEventListener("mouseup", (e) => {
    if (host && e.composedPath().includes(host)) return;
    if (!modifierHeld(e)) return;
    setTimeout(onSelectionSettled, 120);
  });
  // Keyboard selections: the bubble appears when the modifier that made the selection is released.
  document.addEventListener("keyup", (e) => {
    if (e.key === "Escape") hide();
    else if ((e.key === "Shift" && trigger !== "alt") || (e.key === "Alt" && trigger === "alt")) setTimeout(onSelectionSettled, 120);
  });
  document.addEventListener("mousedown", (e) => {
    if (host && !e.composedPath().includes(host)) hide();
  });
  document.addEventListener("scroll", () => hide(), { passive: true, capture: true });
})();

export {};
