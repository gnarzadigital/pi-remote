import { Moon, Settings, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { cn, hapticTap } from "@/lib/utils";

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { snapshot, bridge } = usePiBridge();

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
        <DialogContent className="max-w-sm">
          <DialogTitle>Settings</DialogTitle>
          <section className="space-y-2">
            <p className="text-[12px] font-medium uppercase tracking-wide text-concrete">Appearance</p>
            <div className="grid grid-cols-2 gap-2">
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
            </div>
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
