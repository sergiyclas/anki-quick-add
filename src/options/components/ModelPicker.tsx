import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { send } from "../../lib/messages";
import { MODEL_CATALOG } from "../../lib/providers/catalog";
import type { ModelInfo } from "../../lib/providers/types";
import type { ProviderId, ProviderSettings } from "../../lib/settings/schema";
import { getCache } from "../../lib/settings/storage";

interface Props {
  provider: ProviderId;
  cfg: ProviderSettings;
  apiKey: string;
  onChange(model: string): void;
}

// Free-text model id with a dropdown of the static catalog plus whatever "Refresh" fetched from the provider.
export function ModelPicker({ provider, cfg, apiKey, onChange }: Props) {
  const [fetched, setFetched] = useState<ModelInfo[]>([]);
  const [status, setStatus] = useState<{ text: string; cls: string }>({ text: "", cls: "" });

  useEffect(() => {
    setFetched([]);
    setStatus({ text: "", cls: "" });
    getCache<ModelInfo[]>(`providerModels:${provider}`).then((c) => c && setFetched(c.items));
  }, [provider]);

  async function refresh() {
    setStatus({ text: "…", cls: "muted" });
    const r = await send({ type: "provider.listModels", provider, cfg, key: apiKey });
    if (r.ok) {
      setFetched(r.models);
      setStatus({ text: t("models_fetched", [String(r.models.length)]), cls: "ok" });
    } else {
      setStatus({ text: r.error, cls: "err" });
    }
  }

  const options = new Map<string, string | undefined>();
  for (const m of [...MODEL_CATALOG[provider], ...fetched]) options.set(m.id, m.label);

  return (
    <label class="field">
      <span>{t("opt_model")}</span>
      <div class="row">
        <input type="text" list={`models-${provider}`} value={cfg.model} onInput={(e) => onChange(e.currentTarget.value.trim())} />
        <button type="button" class="secondary" onClick={refresh}>
          {t("refresh_models")}
        </button>
      </div>
      <datalist id={`models-${provider}`}>
        {[...options].map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </datalist>
      <div class={`hint ${status.cls}`}>{status.text || t("opt_model_hint")}</div>
    </label>
  );
}
