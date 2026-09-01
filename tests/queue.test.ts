import { describe, expect, it } from "vitest";
import { base64FromBlob, blobFromBase64 } from "../src/lib/queue/media";

// The queue stores media as Blobs and hands them back to AnkiConnect as base64; the round trip has to
// be byte-exact, including bytes that are not valid UTF-8.
describe("queue media", () => {
  it("round-trips binary data", async () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const base64 = btoa(String.fromCharCode(...bytes));
    const blob = blobFromBase64(base64, "audio/mpeg");
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBe(bytes.length);
    expect(await base64FromBlob(blob)).toBe(base64);
  });

  it("handles data larger than the fromCharCode argument limit", async () => {
    const bytes = new Uint8Array(200 * 1024).fill(0xab);
    const blob = new Blob([bytes]);
    const base64 = await base64FromBlob(blob);
    const back = blobFromBase64(base64, "image/jpeg");
    expect(back.size).toBe(bytes.length);
    expect(new Uint8Array(await back.arrayBuffer())[199_999]).toBe(0xab);
  });

  it("round-trips an empty payload", async () => {
    expect(await base64FromBlob(blobFromBase64("", "image/jpeg"))).toBe("");
  });
});
