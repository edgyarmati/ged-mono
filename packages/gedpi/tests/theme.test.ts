import { describe, expect, test } from "vitest";

import {
  applyPreset,
  createGedTheme,
  getBrandHex,
  getWelcomeHex,
  loadPresetJson,
  PRESETS,
} from "../src/theme.js";

const REQUIRED_COLOR_KEYS = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "selectedBg",
  "userMessageBg",
  "userMessageText",
  "customMessageBg",
  "customMessageText",
  "customMessageLabel",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "bashMode",
];

describe("theme JSON files", () => {
  const presetNames = Object.keys(PRESETS);

  test("every preset has a matching JSON file that loads", () => {
    for (const name of presetNames) {
      const json = loadPresetJson(name);
      expect(json.name).toBe(name);
      expect(json.colors).toBeDefined();
    }
  });

  test("every JSON file has all 51 required color tokens", () => {
    for (const name of presetNames) {
      const json = loadPresetJson(name);
      const colorKeys = Object.keys(json.colors);
      for (const required of REQUIRED_COLOR_KEYS) {
        expect(colorKeys).toContain(required);
      }
    }
  });

  test("all presets share identical non-brand color tokens", () => {
    const firstName = presetNames[0];
    if (!firstName) throw new Error("No presets found");
    const first = loadPresetJson(firstName);
    const firstColors = { ...first.colors };
    // Remove variable references that resolve differently per preset
    delete firstColors.accent;
    delete firstColors.borderAccent;
    delete firstColors.mdCode;
    delete firstColors.mdListBullet;

    for (let i = 1; i < presetNames.length; i++) {
      const name = presetNames[i];
      if (!name) throw new Error("Missing preset name");
      const json = loadPresetJson(name);
      const colors = { ...json.colors };
      delete colors.accent;
      delete colors.borderAccent;
      delete colors.mdCode;
      delete colors.mdListBullet;

      expect(colors).toEqual(firstColors);
    }
  });

  test("PRESETS brand/welcome match JSON vars", () => {
    for (const name of presetNames) {
      const json = loadPresetJson(name);
      const meta = PRESETS[name];
      expect(json.vars?.brand).toBe(meta?.brand);
      expect(json.vars?.welcome).toBe(meta?.welcome);
    }
  });

  test("JSON var references resolve to hex colors", () => {
    const json = loadPresetJson("lavender");
    expect(json.vars?.brand).toBe("#c5bceb");
    expect(json.colors.accent).toBe("brand");
  });
});

describe("createGedTheme", () => {
  test("returns a Theme for the default preset", () => {
    const theme = createGedTheme();
    expect(theme.name).toBe("lavender");
    // Theme should expose fg/bg ANSI helpers
    expect(theme.fg("accent", "test")).toContain("test");
    expect(theme.bg("selectedBg", "test")).toContain("test");
  });

  test("returns a Theme with the active preset name", () => {
    applyPreset("ember");
    const theme = createGedTheme();
    expect(theme.name).toBe("ember");
    expect(getBrandHex()).toBe("#e8836b");
    expect(getWelcomeHex()).toBe("#d4a054");

    // Reset to default for other tests
    applyPreset("lavender");
  });

  test(" Theme colors are split into fg and bg correctly", () => {
    applyPreset("ocean");
    const theme = createGedTheme();
    // Foreground colors should be in fg map
    expect(() => theme.fg("accent", "x")).not.toThrow();
    expect(() => theme.fg("border", "x")).not.toThrow();
    // Background colors should be in bg map
    expect(() => theme.bg("selectedBg", "x")).not.toThrow();
    expect(() => theme.bg("userMessageBg", "x")).not.toThrow();

    // Reset
    applyPreset("lavender");
  });
});
