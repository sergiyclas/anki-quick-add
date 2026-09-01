# Privacy Policy - Anki Quick Add

_Last updated: 2026-09-01_

Anki Quick Add is a browser extension that creates Anki flashcards from words you choose. It has no backend of its own and collects no analytics.

## What data is processed

- **Words and context you add.** When you add a word, the word (and, if you used the context menu, the sentence around your selection) is sent to the LLM provider you configured in the settings (Anthropic, OpenAI, Google, or an OpenAI-compatible endpoint you entered) to generate the card content. It is also used to query public media APIs: Wikipedia / Wikimedia Commons (images, recordings), Wiktionary (recordings), dictionaryapi.dev (English recordings) and Google Translate text-to-speech (audio).
- **API keys.** Keys you enter are stored in your browser's extension storage. If "Sync API keys" is enabled (default), Chrome synchronises them to your other Chrome installations through your Google account, using Chrome's own sync mechanism. You can turn this off in Settings → Backup, after which keys stay on the device.
- **Settings and history.** Your settings, field mappings and a short list of recently added words are stored in the browser's extension storage (synced settings via Chrome Sync; history only locally).
- **Anki data.** The extension talks to the AnkiConnect add-on on your own computer (`127.0.0.1:8765` by default) to list decks and note types and to add notes and media files.

## What is not done

- No data is sent to the extension's author or to any server other than the ones listed above.
- No tracking, telemetry, advertising or fingerprinting.
- No access to page content except the text you selected when you invoke the context menu on it (and the paragraph around it, to extract the sentence).

## Third parties

Requests to LLM providers and media services are governed by their respective privacy policies. Only the services you enable or configure are contacted.

## Permissions

- `storage` - settings, keys, history.
- `contextMenus` - the "Add to Anki" menu on selected text.
- `activeTab`, `scripting` - reading the selection and showing a confirmation toast on the page where you used the context menu.
- Host permissions - AnkiConnect on localhost, the LLM providers' APIs, Wikimedia and dictionary APIs, Google TTS. Optional host permissions are requested only when you enter a custom AnkiConnect or LLM endpoint URL.

## Contact

Questions about this policy can be raised through the project's issue tracker.
