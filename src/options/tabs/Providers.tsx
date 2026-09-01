import { t } from "../../lib/i18n";
import { COMPAT_PRESETS } from "../../lib/providers/presets";
import { PROVIDERS } from "../../lib/providers/registry";
import type { CompatPreset, Effort, JsonMode, ProviderId, ProviderSettings } from "../../lib/settings/schema";
import type { SettingsState } from "../../ui/useSettings";
import { GrantHostButton } from "../components/GrantHostButton";
import { ModelPicker } from "../components/ModelPicker";

const EFFORTS: Effort[] = ["low", "medium", "high"];
const JSON_MODES: JsonMode[] = ["auto", "json_schema", "json_object"];

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").host;
  } catch {
    return "";
  }
}

export function ProvidersTab({ state }: { state: SettingsState }) {
  const { settings, keys, update, updateKeys } = state;
  const id = settings.provider;
  const cfg = settings.providers[id];
  const compatHost = hostOf(cfg.baseUrl);
  const apiKey = id === "compat" ? (keys.compat?.[compatHost] ?? "") : id === "free" ? "" : (keys[id] ?? "");
  const preset = COMPAT_PRESETS.find((p) => p.id === cfg.preset);

  const setCfg = (patch: Partial<ProviderSettings>) =>
    update((s) => ({ ...s, providers: { ...s.providers, [id]: { ...s.providers[id], ...patch } } }));

  const setKey = (value: string) =>
    updateKeys((k) => {
      if (id === "compat") return { ...k, compat: { ...k.compat, [compatHost]: value } };
      if (id === "free") return k;
      return { ...k, [id]: value };
    });

  return (
    <>
      <label class="field">
        <span>{t("opt_provider")}</span>
        <select value={id} onChange={(e) => update((s) => ({ ...s, provider: e.currentTarget.value as ProviderId }))}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {id === "free" && <div class="hint">{t("provider_free_hint")}</div>}

      {id === "compat" && (
        <>
          <label class="field">
            <span>{t("opt_preset")}</span>
            <select
              value={cfg.preset ?? "custom"}
              onChange={(e) => {
                const next = COMPAT_PRESETS.find((p) => p.id === (e.currentTarget.value as CompatPreset))!;
                setCfg({ preset: next.id, baseUrl: next.baseUrl || cfg.baseUrl, jsonMode: "auto", model: "" });
              }}
            >
              {COMPAT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span>{t("opt_base_url")}</span>
            <input type="url" value={cfg.baseUrl ?? ""} placeholder="https://host/v1" onInput={(e) => setCfg({ baseUrl: e.currentTarget.value.trim() })} />
            <GrantHostButton url={cfg.baseUrl ?? ""} />
          </label>
          <label class="field">
            <span>{t("opt_json_mode")}</span>
            <select value={cfg.jsonMode ?? "auto"} onChange={(e) => setCfg({ jsonMode: e.currentTarget.value as JsonMode })}>
              {JSON_MODES.map((m) => (
                <option key={m} value={m}>
                  {m === "auto" ? `auto (${preset?.jsonMode ?? "json_schema"})` : m}
                </option>
              ))}
            </select>
            <div class="hint">{t("opt_json_mode_hint")}</div>
          </label>
        </>
      )}

      {id !== "free" && (
        <>
          <label class="field">
            <span>{t("opt_api_key")}</span>
            <input type="password" value={apiKey} placeholder={preset?.keyOptional ? t("opt_key_optional") : "sk-…"} onInput={(e) => setKey(e.currentTarget.value.trim())} />
            {id === "compat" && !compatHost && <div class="hint">{t("opt_key_needs_host")}</div>}
          </label>

          <ModelPicker provider={id} cfg={cfg} apiKey={apiKey} onChange={(model) => setCfg({ model })} />

          {id !== "compat" && (
            <label class="field">
              <span>{t("opt_effort")}</span>
              <select value={cfg.effort} onChange={(e) => setCfg({ effort: e.currentTarget.value as Effort })}>
                {EFFORTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </>
  );
}
