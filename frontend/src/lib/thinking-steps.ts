/** Split thinking text into display steps for ChainOfThought. */
export function parseThinkingItems(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length > 1) return paragraphs

  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) return lines

  return [trimmed]
}

export function stepTitle(text: string, index: number, streaming: boolean): string {
  const firstLine = text.split(/\n/)[0]?.trim() ?? ""
  const short =
    firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine || `Step ${index + 1}`
  return streaming ? short : short
}
