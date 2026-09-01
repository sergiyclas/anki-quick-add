import { enabledTextSlots } from "../../lib/generation/slots";
import type { TextSlotId } from "../../lib/generation/types";
import { t } from "../../lib/i18n";
import { type FieldMapping, type ListFormat, validateMapping } from "../../lib/note/mapping";
import type { Settings } from "../../lib/settings/schema";

interface Props {
  mapping: FieldMapping;
  fields: string[];
  settings: Settings;
  onChange(patch: (m: FieldMapping) => FieldMapping): void;
}

function FieldSelect({ value, fields, onChange }: { value: string | undefined; fields: string[]; onChange(v: string): void }) {
  const options = value && !fields.includes(value) ? [value, ...fields] : fields;
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.currentTarget.value)}>
      <option value="">{t("not_mapped")}</option>
      {options.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );
}

export function FieldMappingTable({ mapping, fields, settings, onChange }: Props) {
  const slots = enabledTextSlots(settings);
  const setSlot = (slot: TextSlotId, field: string) =>
    onChange((m) => {
      const next = { ...m.fields };
      if (field) next[slot] = field;
      else delete next[slot];
      return { ...m, fields: next };
    });
  const setFormat = <K extends keyof ListFormat>(key: K, value: ListFormat[K]) =>
    onChange((m) => ({ ...m, listFormat: { ...m.listFormat, [key]: value } }));
  const errors = validateMapping(mapping, fields);
  const mediaRows: { key: "audioField" | "imageField" | "creditField"; label: string; show: boolean }[] = [
    { key: "audioField", label: t("slot_audio"), show: settings.media.audio.enabled },
    { key: "imageField", label: t("slot_image"), show: settings.media.image.enabled },
    { key: "creditField", label: t("slot_imageCredit"), show: settings.media.image.enabled && settings.media.image.storeCredit },
  ];

  return (
    <div class="mapping">
      <table>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <th>{t(`slot_${slot}`)}</th>
              <td>
                <FieldSelect value={mapping.fields[slot]} fields={fields} onChange={(f) => setSlot(slot, f)} />
              </td>
              <td class="fmt">
                {slot === "translations" && (
                  <select value={mapping.listFormat.translations} onChange={(e) => setFormat("translations", e.currentTarget.value as "comma" | "lines")}>
                    <option value="comma">{t("fmt_comma")}</option>
                    <option value="lines">{t("fmt_lines")}</option>
                  </select>
                )}
                {slot === "synonyms" && (
                  <select value={mapping.listFormat.synonyms} onChange={(e) => setFormat("synonyms", e.currentTarget.value as "comma" | "lines")}>
                    <option value="comma">{t("fmt_comma")}</option>
                    <option value="lines">{t("fmt_lines")}</option>
                  </select>
                )}
                {slot === "examples" && (
                  <select value={mapping.listFormat.examples} onChange={(e) => setFormat("examples", e.currentTarget.value as "lines" | "list")}>
                    <option value="lines">{t("fmt_lines")}</option>
                    <option value="list">{t("fmt_list")}</option>
                  </select>
                )}
              </td>
            </tr>
          ))}
          {mediaRows
            .filter((r) => r.show)
            .map((r) => (
              <tr key={r.key}>
                <th>{r.label}</th>
                <td>
                  <FieldSelect value={mapping[r.key]} fields={fields} onChange={(f) => onChange((m) => ({ ...m, [r.key]: f || undefined }))} />
                </td>
                <td />
              </tr>
            ))}
          <tr class="dedupe">
            <th>{t("mapping_dedupe_field")}</th>
            <td>
              <FieldSelect value={mapping.dedupeField} fields={fields} onChange={(f) => onChange((m) => ({ ...m, dedupeField: f }))} />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      {Object.keys(mapping.staticFields).length > 0 && (
        <div class="hint">
          {t("mapping_static")}:{" "}
          {Object.entries(mapping.staticFields)
            .map(([k, v]) => `${k} = "${v}"`)
            .join(", ")}
        </div>
      )}
      {errors.length > 0 && (
        <ul class="hint err">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
