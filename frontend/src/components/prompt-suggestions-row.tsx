import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { getPromptSuggestions } from "@/lib/prompt-suggestions";
import { cn } from "@/lib/utils";

type Props = {
  input: string;
  onSelect: (value: string) => void;
  className?: string;
};

export function PromptSuggestionsRow({ input, onSelect, className }: Props) {
  const { snapshot } = usePiBridge();
  const suggestions = getPromptSuggestions(snapshot.commands, input);

  if (
    !snapshot.connected ||
    snapshot.streaming ||
    snapshot.cmdPickerOpen ||
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-2 flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="list"
      aria-label="Suggested prompts"
    >
      {suggestions.map((item) => (
        <PromptSuggestion
          key={item.id}
          type="button"
          variant="outline"
          size="sm"
          title={item.title}
          highlight={item.highlight}
          className="shrink-0 max-w-[min(200px,55vw)] truncate border-hairline bg-chalk text-graphite hover:bg-mist"
          onClick={() => onSelect(item.value)}
        >
          {item.label}
        </PromptSuggestion>
      ))}
    </div>
  );
}
