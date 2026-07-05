import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PromptInputAction } from "@/components/ui/prompt-input";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import {
  filterModels,
  formatModelLabel,
  formatProviderName,
  groupModelsByProvider,
  getProviderList,
  isSameModel,
  modelKey,
} from "@/lib/model-utils";
import type { PiModel } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

const PROVIDER_FILTER_KEY = "pi-remote-model-provider-filter";

function ModelRow({
  model,
  active,
  onSelect,
}: {
  model: PiModel;
  active: boolean;
  onSelect: (model: PiModel) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-2 rounded-[10px] px-2.5 py-2 text-left hover:bg-mist",
        active && "bg-mist ring-1 ring-hairline"
      )}
      onClick={() => {
        hapticTap();
        onSelect(model);
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-graphite">
          {formatModelLabel(model)}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-concrete">
          {formatProviderName(model.provider)} · {model.id}
        </span>
      </span>
      {active ? <Check className="mt-0.5 size-4 shrink-0 text-graphite" aria-hidden /> : null}
    </button>
  );
}

/** onPick overrides where the chosen model is applied (default: primary session
 * via set_model). activeModel overrides which model shows as current — pass null
 * in an agent context where the primary session's model isn't the agent's. */
export function ModelPickerAction({
  onPick,
  activeModel,
}: {
  onPick?: (model: PiModel) => void;
  activeModel?: PiModel | null;
} = {}) {
  const { snapshot, bridge } = usePiBridge();
  const active = activeModel !== undefined ? activeModel : snapshot.activeModel;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>(() => {
    try {
      return localStorage.getItem(PROVIDER_FILTER_KEY) ?? "all";
    } catch {
      return "all";
    }
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    bridge.refreshModels();
    try {
      const saved = localStorage.getItem(PROVIDER_FILTER_KEY);
      if (saved) setProviderFilter(saved);
    } catch {
      // ignore
    }
  }, [open, bridge]);

  const providers = useMemo(() => getProviderList(snapshot.allModels), [snapshot.allModels]);

  const recent = useMemo(
    () =>
      snapshot.recentModels
        .map((r) => snapshot.allModels.find((m) => m.id === r.id && m.provider === r.provider))
        .filter((m): m is PiModel => Boolean(m)),
    [snapshot.allModels, snapshot.recentModels]
  );

  const filtered = useMemo(
    () => filterModels(snapshot.allModels, query, providerFilter),
    [snapshot.allModels, query, providerFilter]
  );

  const filteredRecent = useMemo(
    () => filterModels(recent, query, providerFilter),
    [recent, query, providerFilter]
  );

  const grouped = useMemo(() => groupModelsByProvider(filtered), [filtered]);

  const recentKeys = useMemo(() => new Set(filteredRecent.map(modelKey)), [filteredRecent]);

  const label = active ? formatModelLabel(active) : "Model";

  const selectProvider = (provider: string) => {
    setProviderFilter(provider);
    try {
      localStorage.setItem(PROVIDER_FILTER_KEY, provider);
    } catch {
      // ignore
    }
  };

  const pickModel = (model: PiModel) => {
    if (onPick) onPick(model);
    else bridge.setModel(model);
    setOpen(false);
  };

  const showGrouped = providerFilter === "all" && !query.trim();

  return (
    <PromptInputAction tooltip="Switch model">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="h-7 max-w-[min(140px,32vw)] truncate rounded-full px-2.5 text-[12px] text-concrete hover:text-graphite"
        onClick={(e) => {
          e.stopPropagation();
          hapticTap();
          setOpen(true);
        }}
      >
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(85vh,640px)] max-w-lg flex-col gap-3 overflow-hidden p-4">
          <DialogTitle>Choose model</DialogTitle>

          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-concrete" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="h-9 w-full rounded-[10px] border border-hairline bg-canvas pl-8 pr-3 text-[14px] text-graphite placeholder:text-concrete"
              aria-label="Search models"
            />
          </div>

          <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ProviderChip
              active={providerFilter === "all"}
              label={`All (${snapshot.allModels.length})`}
              onClick={() => selectProvider("all")}
            />
            {providers.map((provider) => {
              const count = snapshot.allModels.filter((m) => m.provider === provider).length;
              return (
                <ProviderChip
                  key={provider}
                  active={providerFilter === provider}
                  label={`${formatProviderName(provider)} (${count})`}
                  onClick={() => selectProvider(provider)}
                />
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-[13px] text-concrete">
                {snapshot.allModels.length === 0
                  ? "Loading models…"
                  : "No models match"}
              </p>
            ) : (
              <>
                {filteredRecent.length > 0 ? (
                  <section className="mb-3">
                    <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-concrete">
                      Recent
                    </p>
                    <div className="space-y-0.5">
                      {filteredRecent.map((model) => (
                        <ModelRow
                          key={`recent-${modelKey(model)}`}
                          model={model}
                          active={isSameModel(active, model)}
                          onSelect={pickModel}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {showGrouped ? (
                  grouped.map(({ provider, models }) => {
                    const visible = models.filter((m) => !recentKeys.has(modelKey(m)));
                    if (visible.length === 0) return null;
                    return (
                      <section key={provider} className="mb-3 last:mb-0">
                        <p className="sticky top-0 z-[1] bg-chalk px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-concrete">
                          {formatProviderName(provider)} ({visible.length})
                        </p>
                        <div className="space-y-0.5">
                          {visible.map((model) => (
                            <ModelRow
                              key={modelKey(model)}
                              model={model}
                              active={isSameModel(active, model)}
                              onSelect={pickModel}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  <div className="space-y-0.5">
                    {filtered
                      .filter((m) => !recentKeys.has(modelKey(m)))
                      .map((model) => (
                        <ModelRow
                          key={modelKey(model)}
                          model={model}
                          active={isSameModel(active, model)}
                          onSelect={pickModel}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
          <p className="shrink-0 text-center text-[11px] text-concrete">
            {filtered.length} shown · tap a provider chip to filter
          </p>
        </DialogContent>
      </Dialog>
    </PromptInputAction>
  );
}

function ProviderChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-graphite bg-graphite text-chalk"
          : "border-hairline bg-canvas text-graphite hover:bg-mist"
      )}
      onClick={() => {
        hapticTap();
        onClick();
      }}
    >
      {label}
    </button>
  );
}
