import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../src/lib/settings/schema";
import { effectiveMode, isDarkBySchedule } from "../src/ui/theme";

const at = (hhmm: string) => new Date(`2026-09-01T${hhmm}:00`);

describe("isDarkBySchedule", () => {
  it("handles a range that crosses midnight", () => {
    expect(isDarkBySchedule("20:00", "07:00", at("22:30"))).toBe(true);
    expect(isDarkBySchedule("20:00", "07:00", at("03:15"))).toBe(true);
    expect(isDarkBySchedule("20:00", "07:00", at("12:00"))).toBe(false);
  });

  it("treats the start as inclusive and the end as exclusive", () => {
    expect(isDarkBySchedule("20:00", "07:00", at("20:00"))).toBe(true);
    expect(isDarkBySchedule("20:00", "07:00", at("07:00"))).toBe(false);
    expect(isDarkBySchedule("20:00", "07:00", at("06:59"))).toBe(true);
  });

  it("handles a same-day range and an empty range", () => {
    expect(isDarkBySchedule("09:00", "17:00", at("12:00"))).toBe(true);
    expect(isDarkBySchedule("09:00", "17:00", at("18:00"))).toBe(false);
    expect(isDarkBySchedule("08:00", "08:00", at("08:00"))).toBe(false);
  });
});

describe("effectiveMode", () => {
  const withTheme = (theme: Settings["ui"]["theme"]): Pick<Settings, "ui"> => ({ ui: { ...DEFAULT_SETTINGS.ui, theme } });

  it("passes fixed choices through", () => {
    expect(effectiveMode(withTheme("system"))).toBe("system");
    expect(effectiveMode(withTheme("light"))).toBe("light");
    expect(effectiveMode(withTheme("dark"))).toBe("dark");
  });

  it("resolves the schedule against the clock", () => {
    expect(effectiveMode(withTheme("schedule"), at("23:00"))).toBe("dark");
    expect(effectiveMode(withTheme("schedule"), at("10:00"))).toBe("light");
  });
});
