import { ArrowUp, Mic, Paperclip, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ComposerPrimitive, useAuiState, useComposerRuntime } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { PromptInputAction, PromptInputActions } from "@/components/ui/prompt-input";
import { PromptSuggestionsRow } from "@/components/prompt-suggestions-row";
import { ModelPickerAction } from "@/components/model-picker-action";
import {
  CmdPicker,
  filterCommands,
  InputToolbarChip,
  PendingImagesRow,
  THINKING_LABELS,
} from "@/components/input-area";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { createRecognition, isVoiceSupported, transcriptFromEvent, type Recognition } from "@/lib/speech";
import { cn, hapticTap } from "@/lib/utils";

type PiComposerProps = {
  /** "dock" (default) = pinned to the bottom, hairline border above.
   *  "centered" = for the empty/new-session hero, no dock chrome. */
  variant?: "dock" | "centered";
};

/**
 * assistant-ui port of InputArea: the textarea + send state machine is
 * assistant-ui's ComposerPrimitive (auto-grow, Enter-to-send, focus-on-run
 * mechanics, `composer.send()` -> ExternalStoreRuntime `onNew` -> the exact
 * production `bridge.sendMessage` path, which queues mid-stream). Everything
 * pi-specific — slash picker, queue chips, voice, thinking chip, model picker,
 * interrupt — is the same production chrome talking to the bridge directly.
 */
export function PiComposer({ variant = "dock" }: PiComposerProps) {
  const { snapshot, bridge } = usePiBridge();
  const composer = useComposerRuntime();
  const text = useAuiState((s) => s.composer.text);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const baseInputRef = useRef("");
  const voiceSupported = useMemo(() => isVoiceSupported(), []);
  const matches = useMemo(
    () => filterCommands(snapshot.commands, snapshot.cmdFilter),
    [snapshot.commands, snapshot.cmdFilter]
  );

  const setText = (value: string) => composer.setText(value);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) return;
    const current = composer.getState().text;
    baseInputRef.current = current ? `${current} ` : "";
    rec.onresult = (e) => setText(baseInputRef.current + transcriptFromEvent(e).text);
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

  const handleTextChange = (value: string) => {
    if (value.startsWith("/") && !value.includes(" ")) {
      // Empty session: PromptSuggestion chips. Existing chat: slash dropdown.
      if (snapshot.lines.length > 0) {
        bridge.showCmdPicker(value.slice(1));
      } else {
        bridge.hideCmdPicker();
      }
    } else {
      bridge.hideCmdPicker();
    }
  };

  const selectHighlightedCommand = () => {
    const cmd = matches[snapshot.cmdSelectedIdx];
    if (cmd) setText(bridge.selectCommand(cmd.name));
  };

  const sendCurrent = () => {
    if (!text.trim()) return;
    hapticTap();
    composer.send();
  };

  return (
    <footer
      className={cn(
        "input-footer w-full max-w-full shrink-0 overflow-x-clip px-3 pt-2",
        variant === "dock" && "z-20 border-t border-hairline bg-canvas"
      )}
    >
      <div className="relative w-full max-w-full overflow-x-clip">
        <PendingImagesRow />
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
          <PromptSuggestionsRow input={text} onSelect={setText} />
        </div>
        {snapshot.lines.length > 0 && <CmdPicker onSelect={setText} />}
        <div
          className={cn(
            "cursor-text rounded-[22px] border border-hairline bg-canvas p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
            !snapshot.connected && "cursor-not-allowed opacity-60"
          )}
          onClick={() => document.getElementById("msg-input")?.focus()}
        >
          <ComposerPrimitive.Input
            id="msg-input"
            placeholder={`Message ${snapshot.activeModel?.id ?? "pi"}…`}
            className="max-h-[140px] min-h-[44px] w-full resize-none overflow-y-auto border-none bg-transparent px-1 text-[16px] text-graphite outline-none placeholder:text-concrete md:text-[14px]"
            rows={1}
            disabled={!snapshot.connected}
            cancelOnEscape={false}
            onChange={(e) => handleTextChange(e.target.value)}
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
              if (e.nativeEvent.isComposing) return;
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
                  // preventDefault blocks the primitive's own Enter-submit
                  // (radix composeEventHandlers checks defaultPrevented).
                  e.preventDefault();
                  selectHighlightedCommand();
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  bridge.hideCmdPicker();
                  return;
                }
              }
              // Send directly via the runtime. The primitive's own Enter path
              // requires a wrapping ComposerPrimitive.Root <form>; we skip the
              // form (the pi chrome buttons aren't form-aware) and preventDefault
              // so the primitive's handler stays out of the way. sendCurrent's
              // trim gate keeps whitespace-only from ever sending.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCurrent();
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
                    listening && "animate-pulse bg-mist text-graphite ring-1 ring-hairline"
                  )}
                >
                  <Mic className="size-4" />
                </button>
              </PromptInputAction>
            )}

            {!snapshot.cmdPickerOpen && (
              <InputToolbarChip
                tooltip="Thinking level (Off → Low → High)"
                active={snapshot.thinkingLevel !== "none"}
                onClick={() => bridge.cycleThinking()}
              >
                {THINKING_LABELS[snapshot.thinkingLevel]}
              </InputToolbarChip>
            )}

            <div className="ml-auto flex items-center gap-1">
              {!snapshot.cmdPickerOpen && snapshot.allModels.length > 0 && (
                <ModelPickerAction />
              )}
              {/* While the agent is working, a plain send QUEUES (shown as a Queued
                  chip); "Interrupt" is the explicit cut-in-and-steer path. */}
              {snapshot.streaming && text.trim() && (
                <PromptInputAction tooltip="Interrupt the agent and steer it now">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-7 rounded-full px-2.5 text-[12px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticTap();
                      bridge.sendInterrupt(text);
                      composer.setText("");
                    }}
                  >
                    Interrupt
                  </Button>
                </PromptInputAction>
              )}
              <PromptInputAction tooltip={snapshot.streaming ? "Queue for after this turn" : "Send"}>
                <Button
                  size="icon-sm"
                  className="rounded-full"
                  disabled={!snapshot.connected || !text.trim()}
                  aria-label={snapshot.streaming ? "Queue" : "Send"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (snapshot.cmdPickerOpen && matches.length > 0) {
                      selectHighlightedCommand();
                      return;
                    }
                    sendCurrent();
                  }}
                >
                  <ArrowUp className="size-4" />
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </div>
      </div>
    </footer>
  );
}
