# Chrome Web Store submission kit – Anki Quick Add

Everything the Developer Dashboard asks for, in the order it asks. Fields marked *copy* are meant to
be pasted as-is.

> **Version 2.0.0 was rejected on 2 September 2026** (Spam and Placement in the Store, "Yellow Argon":
> *excessive keywords in the product description*, quoting `OpenRouter, Groq, DeepSeek, xAI, Mistral,
> Ollama, LM Studio`). The description below no longer lists compatible services by name: the three
> providers the extension talks to directly are named once each, and everything else is described as
> "any OpenAI-compatible endpoint". Keep it that way - a list of brand names in the description reads
> as keyword stuffing no matter how accurate it is. No appeal is needed; a corrected draft is simply
> submitted again.
>
> The rejection also linked the branding guidelines. Nothing in them was cited as broken, but the
> title starts with someone else's product name, so the listing has to keep making clear that this is
> a third-party extension for Anki and not published by its authors - which the description does, and
> the icon does not imitate Anki's.

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

Anki Quick Add turns a single word into a finished Anki flashcard, and it works with no API key at all.

Type a word in the popup (Alt+A), or hold Shift and select one while you read. The extension writes the card for you: translation, part of speech, IPA transcription, synonyms, a definition and example sentences at the CEFR level you choose, plus pronunciation audio and an image from Wikipedia with its author and licence. A few seconds later the note is in your own Anki, through the AnkiConnect add-on. Nothing is sent to us, because there is no us: the extension has no account, no server and no telemetry.

THE MEANING THE SENTENCE MEANS
Selecting a word gives you the meaning it carries in that sentence, not the most common one. On a baseball page "bat" becomes the bat you swing rather than the animal, and the usual meaning stays visible underneath. The card gets the same reading, so your deck is not full of the wrong sense.

ANKI CAN STAY CLOSED
A word added while Anki is shut down is still turned into a full card, audio and image included, and waits in a queue on your machine. It is written the moment Anki answers again, so reading never has to stop for a flashcard.

AND SO CAN THE CONNECTION
Chrome can keep a language pack on your device. When the online translator cannot be reached, the extension quietly falls back to it and the bubble keeps translating with no internet at all.

YOUR MODEL, OR NONE
The default needs no account and no key: the card is built from free dictionary and sentence data. If you want grammar notes and sense-aware examples, add your own key for OpenAI, Google Gemini or Anthropic, or point the extension at any OpenAI-compatible endpoint, including a model running on your own computer. Keys stay in your browser and are sent only to the service they belong to.

YOUR CARDS, YOUR WAY
• A built-in note type with a clean two-card template, or map the generated parts onto the fields of a note type you already use
• Preview the result with your real Anki templates before anything is added
• Around 40 languages in any pair, with built-in rules against calques for Ukrainian
• Duplicates: skip them, add anyway, or fill only the empty fields of the note you already have
• An editor window to check, change or regenerate a card before it lands
• List mode for a pasted list of words, with a summary of what was added
• Your decks in the right-click menu
• Interface in 12 languages; light, dark, or dark on a schedule
• Settings sync across your Chrome installations, with JSON export and import

PRO, UNLOCKED WITH A PROMO CODE
Mnemonics and etymology on cards, audio for every example sentence, three card designs, and parallel additions in List mode. The rest is free and stays free.

WHAT IT TALKS TO
Your own Anki on 127.0.0.1 through AnkiConnect; Google Translate for the quick translation and text-to-speech; dictionaryapi.dev and the Tatoeba sentence corpus for pronunciation, definitions and examples; Wikipedia and Wikimedia Commons for images. Only the service you configured, and only when you add a word. The full privacy policy is linked below.

REQUIREMENTS
Anki desktop with the AnkiConnect add-on (code 2055492159), running on the same computer. No AnkiConnect configuration needed. An API key is optional.

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
| Optional host `https://*/*`, `http://*/*` | Never requested at install. Requested from a user gesture only when the user (a) enters the address of a custom OpenAI-compatible endpoint or of a custom AnkiConnect server, or (b) enables the selection bubble, which has to run on the pages the user reads. Disabling the bubble stops the script. |

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

This version replaces the 2.0.0 draft that was rejected for excessive keywords in the description. The list of compatible third-party services has been removed from the listing, and the description now explains what the extension does in prose.

## 7. After the item is live

- README: replace *"Chrome Web Store listing: coming soon"* with the store link; add the YouTube link.
- Tag the release (`git tag v2.2.0 && git push --tags`) and attach the zip to a GitHub release.
- For every later upload: bump `version`, `npm run check`, `node scripts/e2e.mjs`, `npm run zip`.

## Assets in this folder

- `icon128.png` – store icon (96 px artwork, 16 px padding); `icon512.png`, `icon1024.png` – for other listings / press
- `screenshot-1.png` … `screenshot-5.png` – 1280×800, 24-bit PNG
- `promo-small.png` – 440×280; `promo-marquee.png` – 1400×560
- Video: `video/build/out/anki-quick-add-demo.mp4` (1080p, 2:06) – upload to YouTube and link it in the listing
