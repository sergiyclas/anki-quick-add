# Chrome Web Store submission kit – Anki Quick Add

Everything the Developer Dashboard asks for, in the order it asks. Fields marked *copy* are meant to
be pasted as-is.

## 0. Account (one-time)

- Register at https://chrome.google.com/webstore/devconsole: one-time registration fee (historically
  US$5), and the Google account must have 2-Step Verification on – the store refuses to publish or
  update without it.
- **Account tab:** publisher name (shown under the title; `Serhiy Dzen` or a project name), contact
  email (must be verified before anything can be published), and the trader / non-trader declaration,
  which every developer has to answer – an individual publishing a free, open-source extension is a
  non-trader. If the declaration is not on the Account tab, the dashboard asks for it on the item
  before submission.
- New publishers get two extension slots by default (August 2026 policy); one is enough here.

## 1. Package

- `npm run build && npm run zip` → `anki-quick-add-<version>.zip` (manifest.json at the zip root,
  ~125 KB, no source maps, no `key.pem`).
- **Every new upload needs a higher `version` in `public/manifest.json`** (the store refuses the same
  version twice).
- `public/manifest.json` carries a `key` so the local `dist/` build always has the ID
  `cloiddhjganefpijbpjkonahgmlfjlpm`; `npm run zip` strips it, because the store rejects a new item
  whose manifest contains a key ("key field not allowed in manifest") and issues its own key and ID.
  The store ID will therefore differ from the local one; nothing in the extension depends on a fixed
  ID. To make local builds match the published item afterwards, copy the store's public key (Package
  tab → *View public key*) into `manifest.json` → `key` and update `EXT_ID` in `scripts/e2e.mjs` and
  `scripts/capture.ts`.
- The published item is a different extension from the locally loaded `dist/`, so its settings start
  empty: export them from the local build (Settings → General → *Download JSON*) and import them
  into the store build.
- The dashboard runs an automated install test on the draft before submission; a package that fails
  it cannot be submitted.

## 2. Store listing tab

| Field | Value |
|---|---|
| Title | `Anki Quick Add` (from the manifest) |
| Summary | plain text, 132 chars max (*copy*, 128 chars): `One word in, a complete Anki card out: translation, IPA, examples, audio and image. Works with no API key, or with your own LLM.` |
| Description | *copy* – section 2.1 below |
| Category | Education (the store's extension categories are flat; *Tools* is the fallback) |
| Language | English. Ukrainian, German, French, Spanish, Italian, Polish, Portuguese (Brazil), Dutch, Turkish, Japanese and Chinese (Simplified) come from `_locales` – the dashboard lists them automatically once the zip is uploaded |
| Store icon | `store/icon128.png` (128×128, 96 px artwork + 16 px transparent padding) |
| Screenshots | `store/screenshot-1.png` … `screenshot-5.png` (1280×800, 24-bit PNG, no alpha), in that order: card, popup, selection bubble, offline queue, settings |
| Small promo tile | `store/promo-small.png` (440×280) – required |
| Marquee promo tile | `store/promo-marquee.png` (1400×560) – optional, used only if the store features the item |
| YouTube video | the URL of the uploaded `video/build/out/anki-quick-add-demo.mp4` (2:06); upload it as Public or Unlisted first |
| Official URL | leave empty (requires a Search Console-verified site; GitHub cannot be verified) |
| Homepage URL | `https://github.com/sergiyclas/anki-quick-add` |
| Support URL | `https://github.com/sergiyclas/anki-quick-add/issues` |
| Mature content | No |

### 2.1 Description (*copy*)

Anki Quick Add turns a single word into a complete Anki flashcard – and it works with no API key at all.

Type a word in the popup (Alt+A) or hold Shift and select it on any page. Out of the box the extension builds the card from free sources (Google Translate's dictionary data, dictionaryapi.dev, the Tatoeba sentence corpus): translation, part of speech, IPA, synonyms, definition and example sentences, plus pronunciation audio and a Wikipedia image. Plug in your own LLM key and you also get grammar notes, sense-aware translations and examples at your CEFR level. The note lands in Anki through AnkiConnect in a few seconds.

WHAT YOU GET ON EVERY CARD
• Translation(s) in your language
• IPA transcription and part of speech
• Example sentences at the CEFR level you choose, optionally translated
• Synonyms and a short grammar note (gender, plural, irregular forms, aspect…)
• Pronunciation audio: dictionary or Wiktionary recording, Google TTS as fallback
• A Wikipedia image chosen for the intended sense, with author and license stored

WORKS WITH YOUR SETUP
• No key needed: the Free provider is the default.
• Or bring your own key: OpenAI, Google Gemini, Anthropic, or any OpenAI-compatible endpoint (OpenRouter, Groq, DeepSeek, xAI, Mistral, Ollama, LM Studio). Your keys stay in your browser.
• Built-in note type with a clean two-card template, or map the generated parts onto the fields of any note type you already use – and preview the result with your real Anki templates.
• Around 40 languages in any pair. Ukrainian targets get built-in anti-calque rules.
• Interface in 12 languages, switchable inside the extension; light, dark or dark-on-a-schedule theme.
• Duplicate policy: skip, add anyway, or fill the empty fields of the existing note.
• Anki does not have to be running: cards wait in a queue with their audio and image and land as soon as it is back.

FAST WHEN YOU WANT IT, CAREFUL WHEN YOU NEED IT
• Instant Google translation while you type – no LLM tokens spent until you press Enter
• The meaning that fits the sentence: "bat" on a baseball page becomes the bat you swing, not the animal
• Optional on-device language pack, so the bubble keeps translating with no connection
• Selection bubble on web pages (opt-in, Shift + select): the sentence around the word travels along as context, so "bat" on a baseball page becomes the baseball bat, not the animal
• Right-click menu with your decks
• Editor window (Shift+Enter) to review, edit, drop the image or regenerate with a hint before anything is added
• List mode: paste a list of words, get a summary of added / duplicates / errors
• Settings sync across your Chrome installs, JSON export/import

PRO (promo code)
• Mnemonics and etymology on cards, audio for every example sentence, card themes (Classic, Paper, Midnight), parallel additions in List mode.

REQUIREMENTS
• Anki desktop running with the AnkiConnect add-on (code 2055492159). No AnkiConnect configuration needed.
• Optional: an API key for an LLM provider, or a local model via Ollama / LM Studio.

Free and open source (MIT): https://github.com/sergiyclas/anki-quick-add

## 3. Privacy practices tab

### Single purpose (*copy*)

Creating Anki flashcards from words the user types or selects: the card content comes from free dictionary sources or from the LLM provider the user configured, media from public sources, and the note is added to the user's own Anki through the AnkiConnect add-on.

### Permission justifications (*copy* each)

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings, field mappings, API keys (in the browser's extension storage only) and a short history of added words. |
| `unlimitedStorage` | Cards added while Anki is closed are held in a local queue until Anki accepts them. Each card carries its pronunciation audio and image, so the 10 MB default budget would hold only about 45 of them; the queue is deleted as soon as the cards are written to Anki. |
| `alarms` | Retries that queue every few minutes, so the cards land as soon as Anki is running again, and closes the hidden translator page when it has been idle. |
| `offscreen` | Chrome's built-in on-device translator is only exposed to a document, never to an extension service worker. A hidden page is opened on demand to run offline translations and closed again after a few idle minutes. |
| `contextMenus` | Adds the "Add to Anki" entry to the context menu shown on selected text. |
| `activeTab` | When the user invokes the context menu, reads the selected text and its paragraph on that tab to extract the sentence used as context, and shows a small confirmation toast on the same page. |
| `scripting` | Injects the selection reader and the confirmation toast into the active tab (context-menu flow), and registers the optional selection-bubble content script when the user turns the bubble on in the settings. |
| Host `http://127.0.0.1:8765/*`, `http://localhost:8765/*` | The AnkiConnect add-on of the user's own Anki listens there; used to list decks and note types and to add notes and media. |
| Host `https://api.anthropic.com/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*` | The LLM providers the user can choose; a request is made only when the user adds a word and only to the provider whose key the user entered. |
| Host `https://translate.google.com/*`, `https://translate.googleapis.com/*` | Google Translate: pronunciation audio (text-to-speech) and the dictionary data behind the instant translation preview and the keyless Free provider. |
| Host `https://*.wikipedia.org/*`, `https://*.wiktionary.org/*`, `https://commons.wikimedia.org/*`, `https://upload.wikimedia.org/*` | Card images (Wikipedia lead image, Commons search) and native pronunciation recordings, with author and license metadata. |
| Host `https://api.dictionaryapi.dev/*` | English pronunciation recordings; IPA, definitions and examples for the keyless Free provider. |
| Host `https://tatoeba.org/*` | Example sentences with translations for the keyless Free provider. |
| Optional host `https://*/*`, `http://*/*` | Never requested at install. Requested from a user gesture only when the user (a) enters a custom OpenAI-compatible endpoint (e.g. a local Ollama server) or a custom AnkiConnect address, or (b) enables the selection bubble, which has to run on the pages the user reads. Disabling the bubble stops the script. |

### Remote code

**No** – all JavaScript ships inside the package. The extension fetches only data (JSON, audio and image files) from the hosts listed above.

### Data usage

Tick:

- **Website content** – the text the user selects on a page (and the surrounding sentence) is sent to the provider the user configured (Google Translate's dictionary endpoint, dictionaryapi.dev and Tatoeba for the Free provider, or the user's LLM provider) to build the card, and only when the user triggers an add. Nothing is transferred to the developer; a card waiting for a closed Anki is stored locally only.
- **Authentication information** – the user's own API keys for LLM providers are stored in the browser's extension storage (Chrome Sync when enabled) and sent only to the provider they belong to.

Leave unticked: personally identifiable information, health, financial and payment information,
personal communications, location, web history, user activity.

Certify all three statements:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL (entered on this tab)

`https://github.com/sergiyclas/anki-quick-add/blob/main/PRIVACY.md` – required because the extension
handles user data (website content, API keys).

## 4. Distribution tab

- Visibility: **Public** (or *Unlisted* for a soft launch: no listing, installable by URL; same
  review, same policy requirements).
- Regions: all.
- Payments: free, no in-app purchases (the Pro tier is unlocked by promo codes distributed
  outside the store; nothing is sold through the extension).

## 5. What to expect from the review

- Usually a few days, up to a few weeks; after three weeks, contact developer support.
- The broad `optional_host_permissions` (`https://*/*`) are the one thing likely to draw an in-depth
  look; the justification above explains when they are requested and that install needs none of it.
- No remote code, no obfuscation, no affiliate links, no account – nothing else on the review-trigger list.

## 6. Notes for the reviewer (*copy* into the review notes / additional information field if offered)

Testing requires the Anki desktop app with the AnkiConnect add-on (https://ankiweb.net/shared/info/2055492159, add-on code 2055492159); AnkiConnect's default configuration already allows requests from extensions. Without Anki running the card is built and held in a local queue (Settings → General shows it). With Anki running: press Alt+A (or click the icon), type "harbor", press Enter – the default Free provider needs no API key and adds a note to the "Default" deck (translation, IPA, examples, pronunciation audio, image). Without Anki the popup shows "Anki: offline" and nothing is sent anywhere. LLM providers are optional and need the user's own key. The selection bubble is off by default; enabling it in Settings → Languages & Generation prompts for the site permission. No account, no backend, no remote code; source: https://github.com/sergiyclas/anki-quick-add

## 7. After the item is live

- README: replace *"Chrome Web Store listing: coming soon"* with the store link; add the YouTube link.
- Tag the release (`git tag v2.2.0 && git push --tags`) and attach the zip to a GitHub release.
- For every later upload: bump `version`, `npm run check`, `node scripts/e2e.mjs`, `npm run zip`.

## Assets in this folder

- `icon128.png` – store icon (96 px artwork, 16 px padding); `icon512.png`, `icon1024.png` – for other listings / press
- `screenshot-1.png` … `screenshot-5.png` – 1280×800, 24-bit PNG
- `promo-small.png` – 440×280; `promo-marquee.png` – 1400×560
- Video: `video/build/out/anki-quick-add-demo.mp4` (1080p, 2:06) – upload to YouTube and link it in the listing
