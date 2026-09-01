import { useEffect, useState } from "preact/hooks";
import { t } from "../../lib/i18n";
import { hasOrigin, originPattern, requestOrigin } from "../../lib/settings/permissions";

// Shows a "Grant access" button when the extension lacks host permission for the given URL.
export function GrantHostButton({ url }: { url: string }) {
  const pattern = originPattern(url);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!pattern) return;
    hasOrigin(pattern).then(setGranted);
  }, [pattern]);

  if (!pattern || granted !== false) return null;
  return (
    <div class="row hint warn">
      <span>{t("host_not_granted", [pattern])}</span>
      <button type="button" class="secondary" onClick={() => requestOrigin(pattern).then(setGranted)}>
        {t("grant_access")}
      </button>
    </div>
  );
}
