import { LANGUAGES } from "../../lib/languages";

export function LanguageSelect({ value, onChange }: { value: string; onChange(code: string): void }) {
  const known = LANGUAGES.some((l) => l.code === value);
  return (
    <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {!known && <option value={value}>{value}</option>}
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
