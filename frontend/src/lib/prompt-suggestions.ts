import type { PiCommand } from "@/lib/types";

export type PromptSuggestionItem = {
  id: string;
  label: string;
  value: string;
  title?: string;
  highlight?: string;
};

const MAX = 5;

function commandItems(commands: PiCommand[], limit = MAX): PromptSuggestionItem[] {
  return commands.slice(0, limit).map((c) => ({
    id: c.name,
    label: `/${c.name}`,
    value: `/${c.name} `,
    title: c.description,
  }));
}

function matchingCommands(
  commands: PiCommand[],
  query: string,
  limit = MAX
): PromptSuggestionItem[] {
  const q = query.toLowerCase();
  return commands
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map((c) => ({
      id: c.name,
      label: `/${c.name}`,
      value: `/${c.name} `,
      title: c.description,
      highlight: q || undefined,
    }));
}

/** Real suggestions from pi slash commands — no hardcoded prompts. Slash-only (D). */
export function getPromptSuggestions(
  commands: PiCommand[],
  input: string
): PromptSuggestionItem[] {
  if (commands.length === 0) return [];

  const trimmed = input.trim();

  if (!trimmed.startsWith("/") || trimmed.includes(" ")) {
    return [];
  }

  const filter = trimmed.slice(1);
  if (!filter) return commandItems(commands);

  return matchingCommands(commands, filter).map((item) => ({
    ...item,
    label: `/${item.id}`,
    highlight: filter,
  }));
}
