import { describe, expect, test } from "bun:test";
import { clampUiScale, normalizeUiPrefs, UI_SCALE_MAX, UI_SCALE_MIN } from "./ui-prefs";

describe("clampUiScale", () => {
  test("clamps to range and steps", () => {
    expect(clampUiScale(99)).toBe(UI_SCALE_MAX);
    expect(clampUiScale(0)).toBe(UI_SCALE_MIN);
    expect(clampUiScale(1.02)).toBe(1);
    expect(clampUiScale(NaN)).toBe(1);
  });
});

describe("normalizeUiPrefs", () => {
  test("fills defaults for missing/garbage fields", () => {
    expect(normalizeUiPrefs(null)).toEqual({ chatScale: 1, terminalScale: 1, terminalFit: true });
    expect(normalizeUiPrefs({ chatScale: "big", terminalFit: 0 })).toEqual({
      chatScale: 1,
      terminalScale: 1,
      terminalFit: true,
    });
  });
  test("keeps valid values", () => {
    expect(normalizeUiPrefs({ chatScale: 1.2, terminalScale: 0.9, terminalFit: false })).toEqual({
      chatScale: 1.2,
      terminalScale: 0.9,
      terminalFit: false,
    });
  });
});
