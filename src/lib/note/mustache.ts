// Minimal renderer for Anki card templates, used only for the settings preview.
// Supports {{Field}}, {{FrontSide}}, {{#Field}}…{{/Field}}, {{^Field}}…{{/Field}}, {{text:Field}},
// {{hint:Field}}, {{type:Field}}, {{Tags}}, {{Deck}}, {{Subdeck}}, {{Card}}, {{Type}}; drops {{tts …}}.

export interface RenderContext {
  fields: Record<string, string>;
  frontSide?: string;
  card: string;
  deck: string;
  type: string;
  tags: string[];
}

const SECTION = /\{\{([#^])\s*([^{}]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/;

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// Anki treats a field as empty when it has no text content and no media.
export function isFieldEmpty(value: string | undefined): boolean {
  if (!value) return true;
  if (/<img\b|\[sound:/i.test(value)) return false;
  return stripHtml(value).trim() === "";
}

function renderSections(template: string, ctx: RenderContext): string {
  let out = template;
  for (let match = SECTION.exec(out); match; match = SECTION.exec(out)) {
    const [whole, kind, name, body] = match;
    const empty = isFieldEmpty(ctx.fields[name!]);
    const keep = kind === "#" ? !empty : empty;
    out = out.slice(0, match.index) + (keep ? renderSections(body!, ctx) : "") + out.slice(match.index + whole.length);
  }
  return out;
}

function renderTag(raw: string, ctx: RenderContext): string {
  const name = raw.trim();
  switch (name) {
    case "FrontSide":
      return ctx.frontSide ?? "";
    case "Tags":
      return ctx.tags.join(" ");
    case "Deck":
      return ctx.deck;
    case "Subdeck":
      return ctx.deck.split("::").pop() ?? ctx.deck;
    case "Card":
      return ctx.card;
    case "Type":
      return ctx.type;
  }
  const colon = name.indexOf(":");
  const filter = colon >= 0 ? name.slice(0, colon).trim() : "";
  const field = colon >= 0 ? name.slice(colon + 1).trim() : name;
  const value = ctx.fields[field] ?? "";
  switch (filter) {
    case "text":
      return stripHtml(value);
    case "hint":
      return value ? `<span class="hint">${value}</span>` : "";
    case "type":
      return `<input class="typeans" placeholder="(type the answer)">`;
    default:
      return value;
  }
}

export function renderTemplate(template: string, ctx: RenderContext): string {
  const withoutTts = template.replace(/\{\{tts(?:-voices)?\b[^}]*\}\}/g, "");
  const rendered = renderSections(withoutTts, ctx).replace(/\{\{([^{}#^/][^{}]*)\}\}/g, (_, raw: string) => renderTag(raw, ctx));
  return rendered.replace(/\[sound:[^\]]+\]/g, '<span class="aqa-sound" title="audio">&#128266;</span>');
}
