import type { PiModel } from "@/lib/types";

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  "amazon-bedrock": "Amazon Bedrock",
  "azure-openai-responses": "Azure OpenAI",
  cerebras: "Cerebras",
  "cloudflare-ai-gateway": "Cloudflare Gateway",
  "cloudflare-workers-ai": "Cloudflare Workers",
  deepseek: "DeepSeek",
  fireworks: "Fireworks",
  google: "Google Gemini",
  "google-vertex": "Google Vertex",
  groq: "Groq",
  huggingface: "Hugging Face",
  "kimi-coding": "Kimi Coding",
  mistral: "Mistral",
  minimax: "MiniMax",
  "minimax-cn": "MiniMax (CN)",
  moonshotai: "Moonshot",
  "moonshotai-cn": "Moonshot (CN)",
  opencode: "OpenCode Zen",
  "opencode-go": "OpenCode Go",
  openai: "OpenAI",
  "openai-codex": "OpenAI Codex",
  openrouter: "OpenRouter",
  "vercel-ai-gateway": "Vercel Gateway",
  xai: "xAI",
  zai: "Z.AI",
  xiaomi: "Xiaomi MiMo",
};

const PROVIDER_PIN_ORDER = [
  "openai-codex",
  "zai",
  "openrouter",
  "anthropic",
  "openai",
  "google",
  "local-lightning",
  "local-omlx",
  "local-model-proxy",
];

function parseVersionParts(id: string): number[] {
  const match = id.match(/(\d+(?:\.\d+)*)/);
  if (!match) return [0];
  return match[1].split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareModelsNewestFirst(a: PiModel, b: PiModel): number {
  const va = parseVersionParts(a.id);
  const vb = parseVersionParts(b.id);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (vb[i] ?? 0) - (va[i] ?? 0);
    if (diff !== 0) return diff;
  }
  const codexBoost = Number(b.id.includes("codex")) - Number(a.id.includes("codex"));
  if (codexBoost !== 0) return codexBoost;
  return formatModelLabel(a).localeCompare(formatModelLabel(b));
}

export function formatProviderName(provider: string): string {
  if (PROVIDER_DISPLAY_NAMES[provider]) return PROVIDER_DISPLAY_NAMES[provider];
  if (provider.startsWith("local-")) {
    return `Local / ${provider.slice(6).replace(/-/g, " ")}`;
  }
  return provider.replace(/-/g, " ");
}

export function formatModelLabel(model: PiModel): string {
  return model.name?.trim() || model.id;
}

export function modelKey(model: PiModel): string {
  return `${model.provider}/${model.id}`;
}

export function isSameModel(a: PiModel | null | undefined, b: PiModel | null | undefined): boolean {
  if (!a || !b) return false;
  return a.provider === b.provider && a.id === b.id;
}

export function getProviderList(models: PiModel[]): string[] {
  const providers = [...new Set(models.map((m) => m.provider))];
  return providers.sort((a, b) => {
    const aPin = PROVIDER_PIN_ORDER.indexOf(a);
    const bPin = PROVIDER_PIN_ORDER.indexOf(b);
    if (aPin !== -1 || bPin !== -1) {
      if (aPin === -1) return 1;
      if (bPin === -1) return -1;
      return aPin - bPin;
    }
    return formatProviderName(a).localeCompare(formatProviderName(b));
  });
}

export function groupModelsByProvider(models: PiModel[]): Array<{ provider: string; models: PiModel[] }> {
  const map = new Map<string, PiModel[]>();
  for (const model of models) {
    const bucket = map.get(model.provider) ?? [];
    bucket.push(model);
    map.set(model.provider, bucket);
  }

  return getProviderList(models).map((provider) => ({
    provider,
    models: (map.get(provider) ?? []).sort(compareModelsNewestFirst),
  }));
}

export function filterModels(
  models: PiModel[],
  query: string,
  provider: string | "all"
): PiModel[] {
  const q = query.trim().toLowerCase();
  return models.filter((model) => {
    if (provider !== "all" && model.provider !== provider) return false;
    if (!q) return true;
    const haystack = [
      model.id,
      model.name ?? "",
      model.provider,
      formatProviderName(model.provider),
      model.provider.replace(/-/g, " "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
