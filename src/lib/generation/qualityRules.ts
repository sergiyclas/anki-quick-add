// Per-language quality rules appended to the system prompt when that language is the translation target
// (and, if present, the source). Keyed by ISO 639-1 code.
export const QUALITY_RULES: Record<string, string> = {
  uk: `Ukrainian quality rules: use modern standard literary Ukrainian as in academic dictionaries (СУМ, ВТССУМ). Never use russianisms or calques from Russian - e.g. write "наступний" not "слідуючий", "збігатися" not "співпадати", "скасувати" not "відмінити", "стосуватися" not "відноситися", "брати участь" not "приймати участь", for greetings "вітаю" / "добрий день" / "привіт" and never "здрастуйте" / "здраствуйте", "містити" not "вміщувати в собі", "вимкнути" not "виключити" (for devices), "зазвичай" not "як правило". Prefer the native Ukrainian word over a Russian-sounding synonym when both exist.`,
};
