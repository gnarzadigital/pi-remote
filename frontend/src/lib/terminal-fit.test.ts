import { describe, expect, test } from "bun:test";
import { fitTerminalFontPx, maxLineLength, TERMINAL_FONT_DEFAULT_PX, TERMINAL_FONT_MAX_PX, TERMINAL_FONT_MIN_PX } from "./terminal-fit";

describe("maxLineLength", () => {
  test("longest trimmed line wins", () => {
    expect(maxLineLength("ab\nabcdef   \nabc")).toBe(6);
  });
  test("empty text is 0", () => {
    expect(maxLineLength("")).toBe(0);
  });
});

describe("fitTerminalFontPx", () => {
  // The reported bug: ~45-col capture on a 390pt phone (366px container)
  // rendered at 11px filled only ~60% of the width.
  test("45-col capture on iPhone width scales UP past the old fixed 11px", () => {
    const px = fitTerminalFontPx(45, 366, 0.602);
    expect(px).toBeGreaterThan(TERMINAL_FONT_DEFAULT_PX);
    expect(px).toBeLessThanOrEqual(TERMINAL_FONT_MAX_PX);
    // fitted: 366 / (45 * 0.602) ≈ 13.5
    expect(Math.round(px * 10) / 10).toBeCloseTo(13.5, 0);
  });

  test("wide capture (90 cols) scales DOWN but stays readable", () => {
    const px = fitTerminalFontPx(90, 366, 0.602);
    expect(px).toBeLessThan(TERMINAL_FONT_DEFAULT_PX);
    expect(px).toBeGreaterThanOrEqual(TERMINAL_FONT_MIN_PX);
  });

  test("reflowed paragraphs (very long lines) keep the default", () => {
    expect(fitTerminalFontPx(400, 366, 0.602)).toBe(TERMINAL_FONT_DEFAULT_PX);
  });

  test("trivial captures keep the default", () => {
    expect(fitTerminalFontPx(4, 366, 0.602)).toBe(TERMINAL_FONT_DEFAULT_PX);
  });

  test("fit=false honors only the user scale", () => {
    expect(fitTerminalFontPx(45, 366, 0.602, 1.2, false)).toBeCloseTo(11 * 1.2, 5);
  });

  test("user scale multiplies the fitted size within clamps", () => {
    const base = fitTerminalFontPx(45, 366, 0.602, 1);
    const scaled = fitTerminalFontPx(45, 366, 0.602, 0.85);
    expect(scaled).toBeLessThan(base);
  });
});
