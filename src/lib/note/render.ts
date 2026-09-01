import type { CardData, TextSlotId } from "../generation/types";
import { escapeHtml } from "../text";
import type { ListFormat } from "./mapping";

function renderList(items: string[], format: "comma" | "lines"): string {
  const escaped = items.map(escapeHtml);
  return format === "comma" ? escaped.join(", ") : escaped.join("<br>");
}

function renderText(text: string | undefined): string {
  return text ? escapeHtml(text).replace(/\n/g, "<br>") : "";
}

// Turns one generated slot into the HTML stored in a note field.
export function renderSlot(slot: TextSlotId, card: CardData, format: ListFormat): string {
  switch (slot) {
    case "word":
      return escapeHtml(card.word);
    case "translations":
      return renderList(card.translations, format.translations);
    case "synonyms":
      return renderList(card.synonyms ?? [], format.synonyms);
    case "examples": {
      const items = card.examples.map((e) => {
        const text = escapeHtml(e.text);
        return e.translation ? `${text}<div class="tr">${escapeHtml(e.translation)}</div>` : text;
      });
      return format.examples === "lines"
        ? items.map((i) => `<div>${i}</div>`).join("")
        : `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    }
    case "transcription":
      return renderText(card.transcription);
    case "partOfSpeech":
      return renderText(card.partOfSpeech);
    case "definition":
      return renderText(card.definition);
    case "grammar":
      return renderText(card.grammar);
    case "mnemonic":
      return renderText(card.mnemonic);
    case "etymology":
      return renderText(card.etymology);
    case "context":
      return renderText(card.context);
  }
}
