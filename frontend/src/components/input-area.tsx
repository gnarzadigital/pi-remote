import { ArrowUp, Mic, Paperclip, X } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { PromptSuggestionsRow } from "@/components/prompt-suggestions-row";
import { ModelPickerAction } from "@/components/model-picker-action";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { PiCommand } from "@/lib/types";
import { createRecognition, isVoiceSupported, transcriptFromEvent, type Recognition } from "@/lib/speech";
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
      className="absolute bottom-full left-0 z-30 mb-1 w-full max-w-full overflow-x-clip overflow-y-auto overscroll-contain rounded-[10px] border border-hairline bg-chalk shadow-[0_-8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
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

function InputToolbarChip({
  active,
  onClick,
  children,
  tooltip,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  tooltip: string;
}) {
  return (
    <PromptInputAction tooltip={tooltip}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(
          "h-7 rounded-full px-2.5 text-[12px] text-concrete hover:text-graphite",
          active && "bg-mist text-graphite ring-1 ring-hairline"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {children}
      </Button>
    </PromptInputAction>
  );
}

type InputAreaProps = {
  /** "dock" (default) = pinned to the bottom, hairline border above.
   *  "centered" = for the empty/new-session hero, no dock chrome. */
  variant?: "dock" | "centered";
};

export function InputArea({ variant = "dock" }: InputAreaProps) {
  const { snapshot, bridge } = usePiBridge();
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const baseInputRef = useRef("");
  const voiceSupported = useMemo(() => isVoiceSupported(), []);
  const matches = useMemo(
    () => filterCommands(snapshot.commands, snapshot.cmdFilter),
    [snapshot.commands, snapshot.cmdFilter]
  );

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    baseInputRef.current = input ? `${input} ` : "";
    rec.onresult = (e) => setInput(baseInputRef.current + transcriptFromEvent(e).text);
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setListening(true);
    hapticTap();
    rec.start();
  };

  const handleValueChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/") && !value.includes(" ")) {
      // Empty session: PromptSuggestion chips (D). Existing chat: slash dropdown.
      if (snapshot.lines.length > 0) {
        bridge.showCmdPicker(value.slice(1));
      } else {
        bridge.hideCmdPicker();
      }
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
    <footer
      className={cn(
        "input-footer w-full max-w-full shrink-0 overflow-x-clip px-3 pt-2",
        variant === "dock" && "z-20 border-t border-hairline bg-canvas"
      )}
    >
      <div className="relative w-full max-w-full overflow-x-clip">
        {snapshot.queuedMessages.length > 0 && (
          <div className="mb-1.5 flex flex-col gap-1">
            {snapshot.queuedMessages.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-[10px] border border-hairline bg-mist px-2.5 py-1.5"
              >
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-concrete">
                  Queued
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-graphite">{m}</span>
                <button
                  type="button"
                  aria-label="Cancel queued message"
                  className="shrink-0 text-concrete hover:text-graphite"
                  onClick={() => {
                    hapticTap();
                    bridge.cancelQueued(i);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="absolute bottom-full left-0 z-20 mb-1.5 w-full max-w-full overflow-hidden">
          <PromptSuggestionsRow input={input} onSelect={setInput} />
        </div>
        {snapshot.lines.length > 0 && <CmdPicker onSelect={setInput} />}
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
            className="min-h-[44px] px-1 text-[16px] text-graphite placeholder:text-concrete md:text-[14px]"
            onFocus={() => {
              window.setTimeout(() => {
                document.getElementById("msg-input")?.scrollIntoView({ block: "nearest", inline: "nearest" });
              }, 300);
            }}
            onBlur={() => {
              // iOS fires blur before touchend on picker items.
              // Delay to allow the touch event to register first.
              window.setTimeout(() => bridge.hideCmdPicker(), 300);
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
          <PromptInputActions className="gap-1 px-0.5 pb-0.5 pt-1">
            <PromptInputAction tooltip="Attach image">
              <label className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-concrete hover:bg-mist hover:text-graphite">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-label="Attach image"
                  onChange={(e) => e.target.files && bridge.addPendingImages(e.target.files)}
                />
                <Paperclip className="size-4" />
              </label>
            </PromptInputAction>

            {voiceSupported && (
              <PromptInputAction tooltip={listening ? "Stop dictation" : "Voice input"}>
                <button
                  type="button"
                  aria-label={listening ? "Stop dictation" : "Voice input"}
                  onClick={toggleVoice}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-concrete hover:bg-mist hover:text-graphite",
                    listening && "bg-mist text-graphite ring-1 ring-hairline animate-pulse"
                  )}
                >
                  <Mic className="size-4" />
                </button>
              </PromptInputAction>
            )}

            {!snapshot.cmdPickerOpen && (
              <>
                <InputToolbarChip
                  tooltip="Send mode (Prompt → Steer → Follow-up)"
                  active={snapshot.mode !== "prompt"}
                  onClick={() => bridge.cycleMode()}
                >
                  {MODE_LABELS[snapshot.mode]}
                </InputToolbarChip>
                <InputToolbarChip
                  tooltip="Thinking level (Off → Low → High)"
                  active={snapshot.thinkingLevel !== "none"}
                  onClick={() => bridge.cycleThinking()}
                >
                  {THINKING_LABELS[snapshot.thinkingLevel]}
                </InputToolbarChip>
              </>
            )}

            <div className="ml-auto flex items-center gap-1">
              {!snapshot.cmdPickerOpen && snapshot.allModels.length > 0 && (
                <ModelPickerAction />
              )}
              <PromptInputAction tooltip="Send">
                <Button
                  size="icon-sm"
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
    </footer>
  );
}
