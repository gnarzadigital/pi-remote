import type { ImageAttachment } from "./types";

let idCounter = 0;
export function uid(prefix = "id"): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

export function extractUserText(content: unknown): string {
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .filter((c): c is { type: string; text: string } => c?.type === "text")
      .map((c) => c.text)
      .join("");
  }

  const skillMatch = text.match(/<skill\s+name="([^"]+)"/);
  if (skillMatch) {
    const argsAfter = text.replace(/<skill[^>]*>[\s\S]*?<\/skill>/g, "").trim();
    return `/skill:${skillMatch[1]}${argsAfter ? ` ${argsAfter}` : ""}`;
  }

  const promptMatch = text.match(/<prompt\s+name="([^"]+)"/);
  if (promptMatch) {
    const argsAfter = text.replace(/<prompt[^>]*>[\s\S]*?<\/prompt>/g, "").trim();
    return `/prompt:${promptMatch[1]}${argsAfter ? ` ${argsAfter}` : ""}`;
  }

  return text
    .replace(/<skill[^>]*>[\s\S]*?<\/skill>/g, "")
    .replace(/<prompt[^>]*>[\s\S]*?<\/prompt>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractUserImages(content: unknown): ImageAttachment[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (c): c is ImageAttachment =>
      c?.type === "image" && typeof c.data === "string" && typeof c.mimeType === "string"
  );
}

export function extractToolResultText(content: unknown): string {
  if (!Array.isArray(content)) return String(content ?? "");
  return content
    .filter((c): c is { type: string; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function getModelContextWindowTokens(model: Record<string, unknown> | null): number | null {
  if (!model) return null;
  const direct = [
    model.contextWindow,
    model.context_window,
    model.maxContextTokens,
    model.max_context_tokens,
  ];
  for (const v of direct) {
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

export function getContextUsedTokens(data: { tokens?: Record<string, number> } | null): number | null {
  if (!data?.tokens) return null;
  const t = data.tokens;
  for (const k of ["context", "contextTokens", "context_tokens", "prompt", "input", "total"] as const) {
    const v = t[k];
    if (typeof v === "number" && v >= 0) return v;
  }
  return null;
}

export function buildStatusText(
  connected: boolean,
  streaming: boolean,
  model: { name?: string; id?: string } | null,
  stats: { tokens?: Record<string, number> } | null,
  contextWindow: number | null
): string {
  if (!connected) return "Connecting…";
  const parts: string[] = [streaming ? "Running" : "Ready"];
  if (model) parts.push(model.name ?? model.id ?? "");
  if (stats?.tokens?.total != null) {
    parts.push(`${(stats.tokens.total / 1000).toFixed(1)}k tok`);
  }
  const used = getContextUsedTokens(stats);
  if (used != null && contextWindow != null && contextWindow > 0) {
    parts.push(`${Math.min(100, Math.round((used / contextWindow) * 100))}% ctx`);
  }
  return parts.filter(Boolean).join(" · ");
}
