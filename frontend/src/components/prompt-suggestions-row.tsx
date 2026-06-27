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
    snapshot.lines.length > 0 ||
    !snapshot.connected ||
    snapshot.streaming ||
    snapshot.cmdPickerOpen ||
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <div
      className={cn("w-full max-w-full overflow-hidden", className)}
      role="list"
      aria-label="Suggested prompts"
    >
      <div
        className="flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain rounded-[10px] border border-hairline bg-canvas p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
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
            <span className="block max-w-[9rem] truncate">{item.label}</span>
          </PromptSuggestion>
        ))}
      </div>
    </div>
  );
}
