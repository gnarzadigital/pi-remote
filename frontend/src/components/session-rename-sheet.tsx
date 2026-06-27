import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, hapticTap } from "@/lib/utils";

type Props = {
  open: boolean;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
};

/** iOS-style bottom sheet for renaming a session. */
export function SessionRenameSheet({ open, initialName, onOpenChange, onSave }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setName(initialName);
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open, initialName]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialName.trim();

  const save = () => {
    if (!canSave) return;
    hapticTap();
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-graphite/25 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-chalk shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)]",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-hairline pt-2" aria-hidden />

        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[15px] text-concrete"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <span id={titleId} className="text-[15px] font-semibold text-graphite">
            Rename
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-[15px] font-semibold", canSave ? "text-sky-600" : "text-concrete/50")}
            disabled={!canSave}
            onClick={save}
          >
            Save
          </Button>
        </div>

        <div className="px-4 pb-2">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onOpenChange(false);
              }
            }}
            placeholder="Session name"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="w-full rounded-[12px] border border-hairline bg-canvas px-3 py-3 text-[17px] text-graphite outline-none ring-sky-500/30 focus:ring-2"
          />
        </div>
      </div>
    </>
  );
}
