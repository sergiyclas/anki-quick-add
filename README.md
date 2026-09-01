# Anki Quick Add

Chrome extension that turns a word into a complete Anki card in one step. Type a word in the popup (or select it on any page and right-click) and the extension asks the LLM provider of your choice for the translation, transcription, part of speech, examples, synonyms and grammar notes, fetches pronunciation audio and a Wikipedia image, and adds the note to Anki through [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

## Features

- **Any LLM**: Anthropic, OpenAI, Google Gemini, or any OpenAI-compatible endpoint (OpenRouter, Groq, DeepSeek, xAI, Mistral, Ollama, LM Studio). Your API keys, your account, no middleman.
- **Any note type**: a built-in note type with a clean two-card template, or a field mapping onto your existing note types.
- **Any language pair**: ~40 languages; prompt, TTS, dictionary and Wikipedia lookups follow the pair. Ukrainian targets get built-in anti-russianism rules.
- **Media**: dictionary/Wiktionary recordings with Google TTS fallback; Wikipedia lead image chosen for the intended sense, with author and license stored.
- **Context menu**: one click into the default deck, a submenu of decks, or an editor window to review before adding. The sentence around the selection disambiguates the sense and becomes the first example.
- **Selection bubble**: hold Shift (configurable) while selecting text on any page to get an instant, token-free Google translation with "Add to Anki" / "Edit…" – opt-in, because it needs access to all sites.
- **Batch mode**, duplicate policies (skip / add / update), CEFR level for examples, settings sync across browsers, JSON export/import.
- **UI in 12 languages**: English, Ukrainian, German, French, Spanish, Italian, Polish, Portuguese (Brazil), Dutch, Turkish, Japanese, Chinese (Simplified) – follows the browser language.

## Install (development build)

```bash
npm install
npm run build        # -> dist/
```

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
Open the extension's settings, enter an API key under *Providers*, pick a deck under *Anki*, done.

Requirements: Anki desktop running with the AnkiConnect add-on (code `2055492159`). No AnkiConnect configuration is needed - its default CORS policy already allows extension origins.

## Development

```bash
npm run check        # tsc + unit tests + build
npm run dev          # rebuild on change
npm run e2e          # loads dist/ into a headless Chromium and exercises popup/options (Anki must be running)
npm run zip          # dist/ -> anki-quick-add-<version>.zip for the Web Store
AQA_ANKI=1 npx vitest run tests/integration/anki.test.ts    # live AnkiConnect checks
AQA_NET=1  npx vitest run tests/integration/media.test.ts   # live media API checks
```

`key.pem` (not committed) pins the extension id so settings sync between your own installs; keep it with the release credentials.

## How a card is built

1. The word is normalised (surrounding punctuation trimmed, lone capital lowercased unless the language capitalises nouns).
2. The duplicate-check field of the target note type is searched; the duplicate policy decides what happens.
3. The provider is asked for a JSON object matching a schema derived from your generation settings; pronunciation audio is fetched in parallel.
4. The image is looked up by the Wikipedia title the model suggested for that sense (Commons search as fallback).
5. Generated parts are rendered into fields according to the mapping and the note is added (or the empty fields of the existing note are filled).

## Privacy

Words you add are sent to the LLM provider you configured and, for media, to Wikimedia and dictionary APIs. Nothing is sent anywhere else; see [PRIVACY.md](PRIVACY.md).

## License

MIT
