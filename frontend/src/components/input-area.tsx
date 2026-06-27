import { ArrowUp, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { PromptSuggestionsRow } from "@/components/prompt-suggestions-row";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { PiCommand } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

const MODE_LABELS = { prompt: "Prompt", steer: "Steer", follow_up: "Follow-up" };
const THINKING_LABELS = { none: "Off", low: "Low", high: "High" };

function filterCommands(commands: PiCommand[], filter: string) {
  const q = filter.toLowerCase();
  return commands
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    )
    .slice(0, 8);
}

function CmdPicker({ onSelect }: { onSelect: (value: string) => void }) {
  const { snapshot, bridge } = usePiBridge();
  const matches = useMemo(
    () => filterCommands(snapshot.commands, snapshot.cmdFilter),
    [snapshot.commands, snapshot.cmdFilter]
  );

  if (!snapshot.cmdPickerOpen || matches.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-[min(240px,38dvh)] overflow-y-auto overscroll-contain rounded-[10px] border border-hairline bg-chalk shadow-[0_-8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
      role="listbox"
      aria-label="Slash commands"
    >
      {matches.map((c, i) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={i === snapshot.cmdSelectedIdx}
          className={cn(
            "block w-full border-b border-hairline px-3 py-2.5 text-left last:border-b-0",
            i === snapshot.cmdSelectedIdx ? "bg-mist" : "hover:bg-mist"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(bridge.selectCommand(c.name));
          }}
        >
          <div className="truncate text-[13px] font-medium text-graphite">/{c.name}</div>
          {c.description && (
            <div className="mt-0.5 truncate text-[12px] text-concrete">{c.description}</div>
          )}
        </button>
      ))}
    </div>
  );
}

export function InputArea() {
  const { snapshot, bridge } = usePiBridge();
  const [input, setInput] = useState("");
  const matches = useMemo(
    () => filterCommands(snapshot.commands, snapshot.cmdFilter),
    [snapshot.commands, snapshot.cmdFilter]
  );

  const handleValueChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/") && !value.includes(" ")) {
      bridge.showCmdPicker(value.slice(1));
    } else {
      bridge.hideCmdPicker();
    }
  };

  const sendCurrent = () => {
    const val = input.trim();
    if (!val) return;
    hapticTap();
    bridge.sendMessage(val);
    setInput("");
  };

  return (
    <footer className="input-footer sticky bottom-0 z-20 shrink-0 border-t border-hairline bg-canvas/95 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/90">
      <div className="relative">
        <PromptSuggestionsRow input={input} onSelect={setInput} />
        <CmdPicker onSelect={setInput} />
        <PromptInput
          value={input}
          onValueChange={handleValueChange}
          onSubmit={() => {
            if (snapshot.cmdPickerOpen && matches.length > 0) {
              const cmd = matches[snapshot.cmdSelectedIdx];
              if (cmd) setInput(bridge.selectCommand(cmd.name));
              return;
            }
            sendCurrent();
          }}
          maxHeight={140}
          disabled={!snapshot.connected}
          className="rounded-[14px] border-hairline bg-chalk p-1.5 shadow-none"
        >
          <PromptInputTextarea
            id="msg-input"
            placeholder={`Message ${snapshot.activeModel?.id ?? "pi"}…`}
            className="min-h-[44px] text-[16px] text-graphite placeholder:text-concrete md:text-[14px]"
            onBlur={() => {
              window.setTimeout(() => bridge.hideCmdPicker(), 150);
            }}
            onKeyDown={(e) => {
              if (snapshot.cmdPickerOpen && matches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  bridge.moveCmdSelection(1);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  bridge.moveCmdSelection(-1);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  bridge.hideCmdPicker();
                  return;
                }
              }
            }}
          />
          <PromptInputActions className="px-1 pb-0.5 pt-1">
            <PromptInputAction tooltip="Attach image">
              <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-hairline text-concrete hover:bg-mist">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => e.target.files && bridge.addPendingImages(e.target.files)}
                />
                <Paperclip className="size-4" />
              </label>
            </PromptInputAction>
            <div className="ml-auto">
              <PromptInputAction tooltip="Send">
                <Button
                  size="icon"
                  className="rounded-full"
                  disabled={!snapshot.connected || !input.trim()}
                  aria-label="Send"
                  onClick={(e) => {
                    e.stopPropagation();
                    sendCurrent();
                  }}
                >
                  <ArrowUp className="size-4" />
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
      {!snapshot.cmdPickerOpen && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-[10px] border px-2.5 py-1 text-[12px]",
              snapshot.mode === "prompt"
                ? "border-graphite bg-graphite text-chalk"
                : "border-hairline text-concrete hover:bg-mist"
            )}
            onClick={() => bridge.cycleMode()}
          >
            {MODE_LABELS[snapshot.mode]}
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[10px] border px-2.5 py-1 text-[12px]",
              snapshot.thinkingLevel !== "none"
                ? "border-graphite text-graphite"
                : "border-hairline text-concrete hover:bg-mist"
            )}
            onClick={() => bridge.cycleThinking()}
          >
            {THINKING_LABELS[snapshot.thinkingLevel]}
          </button>
          {snapshot.allModels.length > 0 && <ModelPickerInline />}
        </div>
      )}
    </footer>
  );
}

function ModelPickerInline() {
  const { snapshot, bridge } = usePiBridge();
  const recent = snapshot.recentModels
    .map((r) => snapshot.allModels.find((m) => m.id === r.id && m.provider === r.provider))
    .filter(Boolean);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ml-auto rounded-[10px] border border-hairline px-2.5 py-1 text-[12px] text-concrete hover:bg-mist"
        >
          Model
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
        {recent.length > 0 && (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recent.map((m) => (
              <DropdownMenuItem key={`${m!.provider}/${m!.id}`} onClick={() => bridge.setModel(m!)}>
                {m!.name ?? m!.id}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuLabel>All</DropdownMenuLabel>
        {snapshot.allModels.slice(0, 30).map((m) => (
          <DropdownMenuItem key={`${m.provider}/${m.id}`} onClick={() => bridge.setModel(m)}>
            {m.name ?? m.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
