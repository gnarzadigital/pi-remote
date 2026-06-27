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
        "flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain rounded-[10px] border border-hairline bg-canvas/95 p-1.5 backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
          className="h-7 shrink-0 rounded-full border-hairline bg-chalk px-2.5 text-[11px] text-graphite hover:bg-mist"
          onClick={() => onSelect(item.value)}
        >
          <span className="block max-w-[min(160px,42vw)] truncate">{item.label}</span>
        </PromptSuggestion>
      ))}
    </div>
  );
}
