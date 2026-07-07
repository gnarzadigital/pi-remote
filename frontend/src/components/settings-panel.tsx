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
import {
  getUiPrefs,
  setUiPrefs,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  type UiPrefs,
} from "@/lib/ui-prefs";
import { cn, hapticTap } from "@/lib/utils";

function ScaleSlider({
  label,
  value,
  hint,
  onInput,
  min = UI_SCALE_MIN,
  max = UI_SCALE_MAX,
  step = UI_SCALE_STEP,
  children,
}: {
  label: string;
  value: number;
  hint?: string;
  onInput: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-graphite">{label}</p>
        <span className="text-[13px] tabular-nums text-graphite">{formatTextScalePercent(value)}</span>
      </div>
      {children}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatTextScalePercent(value)}
        className="settings-text-slider h-2 w-full cursor-pointer accent-graphite"
        onInput={(e) => onInput(parseFloat(e.currentTarget.value))}
      />
      {hint && <p className="text-[12px] leading-snug text-concrete">{hint}</p>}
    </div>
  );
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [textScale, setTextScaleLocal] = useState(getTextScale);
  const [uiPrefs, setUiPrefsLocal] = useState<UiPrefs>(getUiPrefs);
  const { snapshot, bridge } = usePiBridge();

  useEffect(() => {
    if (open) {
      setTextScaleLocal(getTextScale());
      applyTextScale(getTextScale());
      setUiPrefsLocal(getUiPrefs());
    }
  }, [open]);

  const patchUiPrefs = (patch: Partial<UiPrefs>) => {
    setUiPrefsLocal(setUiPrefs(patch));
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
        <DialogContent className="max-h-[85dvh] max-w-sm gap-5 overflow-y-auto overscroll-contain">
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

          <section className="space-y-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-concrete">Text size</p>

            <ScaleSlider
              label="Chat messages"
              value={uiPrefs.chatScale}
              hint="Assistant prose and your bubbles. The composer stays at 16px (prevents iOS focus-zoom)."
              onInput={(v) => patchUiPrefs({ chatScale: v })}
            />

            <ScaleSlider
              label="Agent terminals"
              value={uiPrefs.terminalScale}
              hint="Terminal text for claude/codex/hermes agents."
              onInput={(v) => patchUiPrefs({ terminalScale: v })}
            />
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-hairline bg-chalk px-3 py-2">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-graphite">Fit terminal to width</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-concrete">
                  Scales the font so the pane's full line width spans the screen.
                </span>
              </span>
              <input
                type="checkbox"
                checked={uiPrefs.terminalFit}
                aria-label="Fit terminal to width"
                className="size-5 shrink-0 accent-graphite"
                onChange={(e) => {
                  hapticTap();
                  patchUiPrefs({ terminalFit: e.currentTarget.checked });
                }}
              />
            </label>

            <ScaleSlider
              label="Session list"
              value={textScale}
              min={TEXT_SCALE_MIN}
              max={TEXT_SCALE_MAX}
              step={TEXT_SCALE_STEP}
              hint="Session names and folder labels only."
              onInput={(v) => setTextScaleLocal(setTextScale(v))}
            >
              <SessionListTextPreview />
            </ScaleSlider>
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
