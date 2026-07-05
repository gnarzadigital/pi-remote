import { ChevronRight, CornerLeftUp, Folder, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { cn, hapticTap } from "@/lib/utils";

/** Bottom-sheet folder browser for choosing the working directory of a NEW
 * session. Picking "Start here" respawns pi in that folder (see bridge respawnPi)
 * and creates the session there. Mid-session directory change is intentionally
 * not offered — that would reset the running chat. */
export function WorkspacePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { snapshot, bridge } = usePiBridge();
  const listing = snapshot.dirListing;

  useEffect(() => {
    if (open) bridge.listDirs(); // defaults to home
  }, [open, bridge]);

  const go = (path?: string) => {
    hapticTap();
    bridge.listDirs(path);
  };

  const startHere = () => {
    if (!listing) return;
    hapticTap();
    bridge.newSessionInDir(listing.path);
    onOpenChange(false);
  };

  const home = listing?.home;
  const shortcuts = home
    ? [
        { label: "Home", path: home },
        { label: "Desktop", path: `${home}/Desktop` },
        { label: "Documents", path: `${home}/Documents` },
        { label: "Projects", path: `${home}/Projects` },
        { label: "repos", path: `${home}/repos` },
      ]
    : [];

  const short = (p: string) => (home && p.startsWith(home) ? "~" + p.slice(home.length) : p);
  const displayPath = listing ? short(listing.path) : "";

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
        aria-label="Choose folder"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col border-t border-hairline bg-chalk shadow-[0_-8px_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)]",
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-hairline" aria-hidden />

        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <span className="text-[15px] font-semibold text-graphite">New session in folder</span>
          <button
            type="button"
            aria-label="Close"
            className="ml-auto shrink-0 rounded-[10px] p-1 text-concrete hover:bg-mist"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shortcuts.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => go(s.path)}
              className="shrink-0 rounded-full border border-hairline bg-canvas px-2.5 py-1 text-[12px] text-graphite hover:bg-mist"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="shrink-0 truncate px-4 pb-1 font-mono text-[11px] text-concrete">{displayPath || "…"}</div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
          {listing?.parent ? (
            <button
              type="button"
              onClick={() => go(listing.parent!)}
              className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left hover:bg-mist"
            >
              <CornerLeftUp className="size-4 shrink-0 text-concrete" />
              <span className="text-[13px] text-concrete">Up a level</span>
            </button>
          ) : null}
          {(listing?.entries ?? []).map((e) => (
            <button
              key={e.path}
              type="button"
              onClick={() => go(e.path)}
              className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left hover:bg-mist"
            >
              <Folder className="size-4 shrink-0 text-concrete" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-graphite">{e.name}</span>
              <ChevronRight className="size-3.5 shrink-0 text-concrete" />
            </button>
          ))}
          {listing && listing.entries.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-concrete">No sub-folders here</p>
          ) : null}
        </div>

        <div className="shrink-0 px-4 pt-2">
          <Button className="w-full" onClick={startHere} disabled={!listing}>
            Start session in {displayPath ? (displayPath.split("/").pop() || displayPath) : "this folder"}
          </Button>
        </div>
      </div>
    </>
  );
}
