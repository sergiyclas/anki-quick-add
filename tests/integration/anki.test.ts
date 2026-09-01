// Live checks against AnkiConnect. Opt in with AQA_ANKI=1 (Anki must be running); cleans up what it creates.
import { afterAll, describe, expect, test } from "vitest";
import { ensureBuiltinModel } from "../../src/lib/anki/builtinModel";
import { AnkiClient } from "../../src/lib/anki/client";
import { buildNote } from "../../src/lib/note/builder";
import { BUILTIN_FIELDS, defaultMappingForBuiltin } from "../../src/lib/note/mapping";
import { sampleCard } from "../../src/lib/note/sample";
import { BUILTIN_MODEL_NAME, DEFAULT_ANKI_URL, DEFAULT_SETTINGS } from "../../src/lib/settings/schema";

declare const process: { env: Record<string, string | undefined> };

const client = new AnkiClient(process.env["AQA_ANKI_URL"] ?? DEFAULT_ANKI_URL);
const created: number[] = [];
const word = `aqa_it_${Date.now()}`;

describe.skipIf(!process.env["AQA_ANKI"])("AnkiConnect integration", () => {
  afterAll(async () => {
    if (created.length) await client.invoke("deleteNotes", { notes: created });
  });

  test("built-in note type exists (created on demand) with the expected fields", async () => {
    await ensureBuiltinModel(client);
    expect(await client.modelFieldNames(BUILTIN_MODEL_NAME)).toEqual([...BUILTIN_FIELDS]);
    expect(Object.keys(await client.modelTemplates(BUILTIN_MODEL_NAME))).toEqual(["Recognition", "Production"]);
  });

  test("sample note yields one card, or two with the production flag", async () => {
    const card = { ...sampleCard(DEFAULT_SETTINGS), word };
    const base = { deck: "Default", tags: ["aqa", "aqa-integration"], allowDuplicate: true, duplicateScope: "collection" as const };

    const one = await client.addNote(buildNote(card, [], defaultMappingForBuiltin(), { ...base, production: false }));
    created.push(one);
    const two = await client.addNote(buildNote({ ...card, word: `${word}_2` }, [], defaultMappingForBuiltin(), { ...base, production: true }));
    created.push(two);

    const [infoOne, infoTwo] = await client.notesInfo([one, two]);
    expect(infoOne!.cards).toHaveLength(1);
    expect(infoTwo!.cards).toHaveLength(2);
    expect(infoOne!.fields["Translation"]!.value).toBe("черга, черга (у комп'ютерних системах)");
    expect(infoOne!.fields["Examples"]!.value).toContain("<div>We waited in a queue for almost an hour.");
    expect(infoTwo!.fields["Reverse"]!.value).toBe("y");
  });
});
