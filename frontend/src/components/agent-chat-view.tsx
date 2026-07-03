import { ArrowUp, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { ConversationView } from "@/components/conversation-view";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

/**
 * Rich chat view attached to a spawned agent's own pi RPC session (Phase 3.8-full).
 * Reuses ConversationView's turn-block rendering (streaming text/thinking/tools)
 * keyed by the attached agent's state instead of the primary snapshot.
 */
export function AgentChatView() {
  const { snapshot, bridge } = usePiBridge();
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    hapticTap();
    bridge.sendToAttachedAgent(text);
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
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

      <footer className="input-footer z-20 w-full max-w-full shrink-0 overflow-x-clip border-t border-hairline bg-canvas px-3 pt-2">
        <div className="flex items-end gap-2 rounded-[14px] border border-hairline bg-chalk p-1.5">
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
            className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[16px] text-graphite outline-none placeholder:text-concrete md:text-[14px]"
          />
          <Button size="icon-sm" className="mb-0.5 rounded-full" disabled={!input.trim()} aria-label="Send" onClick={send}>
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
