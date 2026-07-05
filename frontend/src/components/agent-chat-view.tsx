import { ArrowUp, ChevronLeft } from "lucide-react";
import { useRef, useState } from "react";
import { ConversationView } from "@/components/conversation-view";
import { ModelPickerAction } from "@/components/model-picker-action";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

/**
 * Rich chat view attached to a spawned agent's own pi RPC session (Phase 3.8-full).
 * Uses the SAME fixed bottom-dock as the primary ChatView (chat-view-root +
 * chat-bottom-dock) so the composer is pinned to the true viewport bottom on iOS
 * — a normal-flow footer floated above the bottom there (the "big void" bug).
 */
export function AgentChatView() {
  const { snapshot, bridge } = usePiBridge();
  const [input, setInput] = useState("");
  const bottomDockRef = useRef<HTMLDivElement>(null);
  useChatBottomInset(bottomDockRef, true);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    hapticTap();
    bridge.sendToAttachedAgent(text);
    setInput("");
  };

  return (
    <div className="chat-view-root flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <ScreenHeader innerClassName="gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] shrink-0 items-center text-[14px] text-graphite hover:opacity-70"
          onClick={() => {
            hapticTap();
            bridge.detachFromAgent();
          }}
        >
          <ChevronLeft className="size-4" />
          <span>Sessions</span>
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-medium text-graphite">
          {snapshot.attachedAgentLabel ?? "Agent"}
        </span>
        <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-concrete">
          Live
        </span>
      </ScreenHeader>

      <ConversationView lines={snapshot.attachedAgentLines} streaming={snapshot.attachedAgentStreaming} />

      <div ref={bottomDockRef} className="chat-bottom-dock">
        <footer className="input-footer w-full max-w-full shrink-0 overflow-x-clip px-3 pt-2">
          <div className="flex flex-col gap-1 rounded-[22px] border border-hairline bg-canvas p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${snapshot.attachedAgentLabel ?? "agent"}…`}
              rows={1}
              className="min-h-[44px] w-full resize-none bg-transparent px-2 py-2 text-[16px] text-graphite outline-none placeholder:text-concrete md:text-[14px]"
            />
            <div className="flex items-center gap-1 px-0.5">
              {/* Model picker routes /model to THIS agent; activeModel=null since we
                  don't track the agent's own current model. */}
              {snapshot.allModels.length > 0 && (
                <ModelPickerAction onPick={(m) => bridge.setAttachedAgentModel(m)} activeModel={null} />
              )}
              <Button
                size="icon-sm"
                className="ml-auto rounded-full"
                disabled={!input.trim()}
                aria-label="Send"
                onClick={send}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
