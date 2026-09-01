# Privacy Policy – Anki Quick Add

_Last updated: 2026-09-01_

Anki Quick Add is a browser extension that creates Anki flashcards from words you type or select. It
has no backend of its own, collects no analytics and never sends anything to the extension's author.

## What data is processed, and where it goes

Everything below happens only when you trigger it (typing in the popup, pressing Enter, clicking
*Add* in the bubble or the context menu, starting a list), and only towards the services you enabled.

- **The word you add, and its context.** The word (plus the sentence around it when you used the
  context menu or the selection bubble) is sent to the provider that builds the card:
  - with the default **Free** provider: Google Translate's dictionary endpoint
    (`translate.googleapis.com`), dictionaryapi.dev (English only) and the Tatoeba sentence corpus
    (`tatoeba.org`);
  - with an LLM provider you configured: Anthropic, OpenAI, Google Gemini, or the OpenAI-compatible
    endpoint you entered (including local ones such as Ollama or LM Studio).
- **Instant translation.** While you type in the popup, and when the selection bubble opens, the
  text is sent to Google Translate (`translate.googleapis.com`) for the one-line preview. Both can be
  turned off in the settings.
- **Media for the card.** The word is used to look up a pronunciation recording and an image on
  Wikipedia / Wikimedia Commons, Wiktionary and dictionaryapi.dev, and to request text-to-speech audio
  from Google Translate (`translate.google.com`). Image author and license are stored on the card.
- **API keys.** Keys you enter are stored in your browser's extension storage and sent only to the
  provider they belong to. If *Sync API keys* is enabled (default), Chrome synchronises them to your
  other Chrome installations through your Google account, using Chrome's own sync; turn it off in
  Settings → General and the keys stay on this device.
- **Offline queue.** When Anki is closed, the finished card (its text and the downloaded audio and
  image) is stored in the browser's IndexedDB on this device until Anki accepts it, then deleted. It
  is never uploaded anywhere.
- **Settings and history.** Settings, field mappings, the selected interface language and theme, and
  a short list of recently added words live in the browser's extension storage (settings via Chrome
  Sync, history only locally). Promo codes are checked locally against a hash; nothing is sent.
- **Anki data.** The extension talks to the AnkiConnect add-on on your own computer
  (`127.0.0.1:8765` by default, or the address you entered) to list decks and note types, check for
  duplicates, and add notes and media files.

## Page content

- **Context menu:** the extension reads only the text you selected and the paragraph around it (to
  extract the sentence), on the tab where you used the menu, and shows a small confirmation toast there.
- **Selection bubble (off by default):** when you enable it, a small script runs on http/https pages
  and reacts to selections made while holding the modifier key you chose. It reads the selected text
  and its paragraph at that moment, and nothing else. Chrome asks you for the broad site permission
  when you turn the bubble on; disabling it stops the script.
- No other page content is read, stored or transmitted.

## What is not done

- No data is sent to the extension's author or to any server other than the ones listed above.
- No tracking, telemetry, advertising, fingerprinting or sale of data.
- No remote code: all code ships inside the extension package.

## Third parties

Requests to LLM providers, Google Translate, Wikimedia projects, dictionaryapi.dev and Tatoeba are
governed by their respective privacy policies. Only the services you enable or configure are contacted.

## Permissions

- `storage`, `unlimitedStorage` – settings, field mappings, keys, history, and the offline queue of
  cards waiting for Anki (which would not fit in the 10 MB default budget).
- `alarms` – retries the offline queue every few minutes.
- `contextMenus` – the *Add to Anki* menu on selected text.
- `activeTab`, `scripting` – reading the selection and showing the confirmation toast on the page
  where you used the menu; registering the selection-bubble script when you enable it.
- Host permissions – AnkiConnect on localhost, the LLM providers' APIs, Google Translate, Wikimedia
  and dictionary APIs, Tatoeba. Broad optional host permissions (`https://*/*`, `http://*/*`) are
  requested only when you enter a custom AnkiConnect or LLM endpoint address, or enable the selection
  bubble; never at install.

## Contact

Questions about this policy can be raised through the project's issue tracker:
https://github.com/sergiyclas/anki-quick-add/issues
