import { Moon, Settings, Sun, Terminal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { SessionListTextPreview } from "@/components/session-list-text-preview";
import {
  applyTextScale,
  formatTextScalePercent,
  getTextScale,
  setTextScale,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
} from "@/lib/text-size";
import { cn, hapticTap } from "@/lib/utils";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [textScale, setTextScaleLocal] = useState(getTextScale);
  const { snapshot, bridge } = usePiBridge();

  useEffect(() => {
    if (open) {
      setTextScaleLocal(getTextScale());
      applyTextScale(getTextScale());
    }
  }, [open]);

  const onTextScaleInput = (value: number) => {
    const next = setTextScale(value);
    setTextScaleLocal(next);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        onClick={() => {
          hapticTap();
          setOpen(true);
        }}
      >
        <Settings className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-5">
          <DialogTitle>Settings</DialogTitle>

          <section className="space-y-2">
            <p className="text-[12px] font-medium uppercase tracking-wide text-concrete">Appearance</p>
            <div className="grid grid-cols-3 gap-2">
              <ThemeOption
                active={snapshot.theme === "light"}
                label="Light"
                icon={<Sun className="size-4" />}
                onSelect={() => {
                  hapticTap();
                  bridge.setTheme("light");
                }}
              />
              <ThemeOption
                active={snapshot.theme === "dark"}
                label="Dark"
                icon={<Moon className="size-4" />}
                onSelect={() => {
                  hapticTap();
                  bridge.setTheme("dark");
                }}
              />
              <ThemeOption
                active={snapshot.theme === "console"}
                label="Console"
                icon={<Terminal className="size-4" />}
                onSelect={() => {
                  hapticTap();
                  bridge.setTheme("console");
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium uppercase tracking-wide text-concrete">Session list text</p>
              <span className="text-[13px] tabular-nums text-graphite">{formatTextScalePercent(textScale)}</span>
            </div>
            <SessionListTextPreview />
            <input
              type="range"
              min={TEXT_SCALE_MIN}
              max={TEXT_SCALE_MAX}
              step={TEXT_SCALE_STEP}
              value={textScale}
              aria-label="Text size"
              aria-valuemin={TEXT_SCALE_MIN}
              aria-valuemax={TEXT_SCALE_MAX}
              aria-valuenow={textScale}
              aria-valuetext={formatTextScalePercent(textScale)}
              className="settings-text-slider h-2 w-full cursor-pointer accent-graphite"
              onInput={(e) => onTextScaleInput(parseFloat(e.currentTarget.value))}
            />
            <div className="flex justify-between text-[11px] text-concrete">
              <span>Smaller</span>
              <span>Default</span>
              <span>Larger</span>
            </div>
            <p className="text-[12px] leading-snug text-concrete">
              Adjusts session names and folder labels only. Timestamps, headers, and chat are unchanged.
            </p>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ThemeOption({
  active,
  label,
  icon,
  onSelect,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] border text-[13px] font-medium transition-colors",
        active
          ? "border-graphite bg-graphite text-chalk"
          : "border-hairline bg-chalk text-graphite hover:bg-mist"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
