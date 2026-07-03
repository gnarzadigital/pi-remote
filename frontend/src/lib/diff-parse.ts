export interface DiffLine {
  type: "add" | "del" | "ctx";
  text: string;
}

export interface ParsedEdit {
  path?: string;
  oldText: string;
  newText: string;
}

/** Parse a pi `edit`/`write` tool's args JSON into old/new text + optional path. */
export function parseEditArgs(args?: string): ParsedEdit | null {
  if (!args) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(args) as Record<string, unknown>;
  } catch {
    return null;
  }
  const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
  const path =
    str("path") ?? str("file") ?? str("filePath") ?? str("file_path") ?? str("filename");
  const oldText = str("oldText") ?? str("old_string") ?? str("old_str") ?? "";
  const newText =
    str("newText") ?? str("new_string") ?? str("new_str") ?? str("content") ?? str("text") ?? "";
  if (oldText === "" && newText === "") return null;
  return { path, oldText, newText };
}

const MAX_DIFF_LINES = 2000; // ponytail: O(m*n) LCS cap; above this we show a coarse diff

/** Minimal LCS line diff. Returns lines tagged add/del/ctx in order. */
export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;

  if (m + n > MAX_DIFF_LINES) {
    // Too large for LCS — show removed block then added block.
    return [
      ...a.map((text): DiffLine => ({ type: "del", text })),
      ...b.map((text): DiffLine => ({ type: "add", text })),
    ];
  }

  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: a[i++] });
  while (j < n) out.push({ type: "add", text: b[j++] });
  return out;
}

/** Count added/removed lines for a compact summary. */
export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "del") removed++;
  }
  return { added, removed };
}
