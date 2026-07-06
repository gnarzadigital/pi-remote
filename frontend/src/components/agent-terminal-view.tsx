import { ArrowUp, Check, ChevronLeft, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { runtimeLabel } from "@/lib/agent-runtime";
import type { AgentTreeNode } from "@/lib/types";
import { hapticTap } from "@/lib/utils";

/** Agents can run in a very narrow cmux split (confirmed live: ~10 columns),
 * so capture-pane returns text hard-wrapped one word per line. When the capture
 * is that narrow, rejoin word-wrapped lines within each blank-line block so it
 * reads as paragraphs on a phone. Wide captures (real terminals) are left exactly
 * as-is — reflowing those would mangle their layout. */
function reflowNarrowPane(text: string): string {
  const lines = text.split("\n");
  const maxLen = lines.reduce((m, l) => Math.max(m, l.trimEnd().length), 0);
  if (maxLen >= 40) return text; // wide enough to read directly
  return text
    .split(/\n{2,}/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n");
}

/** Full-screen conversation view for a TERMINAL-runtime agent (codex/claude/
 * hermes/cursor via cmux). pi agents use the rich RPC chat instead. This shows
 * the agent's live terminal (cmux capture-pane with scrollback, auto-refreshing)
 * and a reply box that steers the pane — you open the whole thing and respond,
 * not a preview. */
export function AgentTerminalView({ agent, onClose }: { agent: AgentTreeNode; onClose: () => void }) {
  const { snapshot, bridge } = usePiBridge();
  const [reply, setReply] = useState("");
  const bodyRef = useRef<HTMLPreElement>(null);
  // Same fixed bottom-dock contract as AgentChatView: publish --chat-bottom-height
  // so the scroll zone reserves room and the composer pins to the true viewport
  // bottom (standalone-PWA home indicator included), no fat black bar.
  const bottomDockRef = useRef<HTMLDivElement>(null);
  useChatBottomInset(bottomDockRef, true);
  // Only auto-scroll on refresh when the user is already at the bottom, so a
  // scroll-up to read isn't yanked back down every 3s. Starts true (open at end).
  const stickToBottom = useRef(true);

  const onScroll = () => {
    const el = bodyRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Load on open; auto-refresh silently so the agent's output streams in.
  useEffect(() => {
    stickToBottom.current = true;
    bridge.capturePane(agent);
    const t = window.setInterval(() => bridge.capturePane(agent, true), 3000);
    return () => window.clearInterval(t);
  }, [agent, bridge]);

  const peek = snapshot.peek;
  const showFor = peek && peek.agentId === agent.id ? peek : null;

  // Keep the newest terminal output in view, but only if the user hasn't
  // scrolled up to read older output.
  useEffect(() => {
    if (bodyRef.current && stickToBottom.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [showFor?.text]);

  const sendReply = () => {
    if (!agent.surface || !reply.trim()) return;
    hapticTap();
    bridge.steerAgent(agent.surface, reply.trim(), agent.workspace);
    setReply("");
    window.setTimeout(() => bridge.capturePane(agent, true), 400);
  };

  const doConfirm = () => {
    if (!agent.surface) return;
    hapticTap();
    bridge.confirmAgent(agent.surface, agent.workspace);
    onClose();
  };

  return (
    <div className="chat-view-root fixed inset-0 z-50 flex flex-col bg-canvas">
      <ScreenHeader innerClassName="gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] shrink-0 items-center text-[14px] text-graphite hover:opacity-70"
          onClick={() => {
            hapticTap();
            onClose();
          }}
        >
          <ChevronLeft className="size-4" />
          <span>Agents</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <span className="max-w-full truncate text-[14px] font-medium text-graphite">{agent.label}</span>
          <span className="text-[11px] text-concrete">
            {runtimeLabel(agent.runtime)}
            {agent.workspaceLabel ? ` · ${agent.workspaceLabel}` : ""}
          </span>
        </div>
        <button
          type="button"
          aria-label="Refresh terminal"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] text-concrete hover:bg-mist hover:text-graphite"
          onClick={() => {
            hapticTap();
            bridge.capturePane(agent, true);
          }}
        >
          <RotateCw className="size-4" />
        </button>
        {agent.status === "awaiting-confirm" && agent.surface ? (
          <Button size="icon-sm" variant="outline" aria-label="Confirm and close" onClick={doConfirm}>
            <Check className="size-4" />
          </Button>
        ) : null}
      </ScreenHeader>

      <pre
        ref={bodyRef}
        onScroll={onScroll}
        className="chat-scroll-zone min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words bg-canvas px-3 py-3 font-mono text-[11px] leading-[1.5] text-graphite"
      >
        {showFor?.loading
          ? "Reading terminal…"
          : showFor?.text
            ? reflowNarrowPane(showFor.text)
            : "Could not read this pane (some agent surfaces don't expose their terminal text). You can still send a message below."}
      </pre>

      <div ref={bottomDockRef} className="chat-bottom-dock">
        <footer className="input-footer w-full max-w-full shrink-0 overflow-x-clip px-3 pt-2">
          <div className="flex items-center gap-2 rounded-[22px] border border-hairline bg-canvas p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Send a message to this agent…"
              aria-label="Message to agent"
              enterKeyHint="send"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[16px] text-graphite outline-none placeholder:text-concrete md:text-[14px]"
            />
            <Button
              size="icon-sm"
              className="shrink-0 rounded-full"
              onClick={sendReply}
              disabled={!reply.trim() || !agent.surface}
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
