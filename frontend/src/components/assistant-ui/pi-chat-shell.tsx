import { createContext, useContext, useMemo, useRef } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useAuiState,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationLine } from "@/components/conversation-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { NewSessionHero } from "@/components/new-session-hero";
import { PiComposer } from "@/components/assistant-ui/pi-composer";
import { StreamingStatusBar } from "@/components/streaming-status-bar";
import { chatLinesToThreadMessages } from "@/lib/assistant-ui-adapter";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { ChatLine } from "@/lib/types";

/** message id (== ChatLine id, set by the adapter) -> the live ChatLine, so
 * each assistant-ui message renders through the EXACT production renderer
 * (ConversationLine: markdown, thinking chain, tool cards, diff viewer,
 * system banners) — the "bespoke renderers stay plug-ins" half of D-3. */
const LineMapContext = createContext<Map<string, ChatLine>>(new Map());

function ShellMessage() {
  const id = useAuiState((s) => s.message.id);
  const line = useContext(LineMapContext).get(id);
  if (!line) return null;
  return (
    <ErrorBoundary inline>
      <ConversationLine line={line} />
    </ErrorBoundary>
  );
}

function JumpToLatest({ streaming }: { streaming: boolean }) {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button
        variant="outline"
        size="icon"
        aria-label={streaming ? "Jump to latest response" : "Jump to latest messages"}
        className="pointer-events-auto ml-auto mr-4 h-10 w-10 rounded-full border-hairline bg-card shadow-md transition-all duration-150 ease-out disabled:pointer-events-none disabled:translate-y-4 disabled:scale-95 disabled:opacity-0"
      >
        <ChevronDown className="h-5 w-5 shrink-0" />
      </Button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

/**
 * assistant-ui chat shell (the ?spike=1 body of ChatView): ExternalStoreRuntime
 * over the live bridge snapshot, ThreadPrimitive viewport for the message list
 * + streaming/scroll mechanics, and the proven in-flow `.chat-bottom-dock`
 * (NOT position:fixed, NOT sticky ViewportFooter — the flex-last-child pattern
 * that survived the iOS standalone saga) hosting the assistant-ui composer.
 */
export function AssistantChatShell() {
  const { snapshot, bridge } = usePiBridge();
  const messages = useMemo(() => chatLinesToThreadMessages(snapshot.lines), [snapshot.lines]);
  const lineMap = useMemo(
    () => new Map(snapshot.lines.map((l): [string, ChatLine] => [l.id, l])),
    [snapshot.lines]
  );

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: snapshot.streaming,
    // `messages` is already ThreadMessageLike (adapter output), not the
    // internal ThreadMessage type — TS requires this identity converter.
    convertMessage: (m) => m,
    onNew: async (msg) => {
      const text = msg.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) bridge.sendMessage(text);
    },
  });

  // Same "black gap" rule as production ChatView: fresh, never-prompted
  // session (no path, no lines) centers the composer instead of docking it.
  const isNewSession = !snapshot.activeSessionPath && snapshot.lines.length === 0;
  const bottomDockRef = useRef<HTMLDivElement>(null);
  useChatBottomInset(bottomDockRef, !isNewSession);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <LineMapContext.Provider value={lineMap}>
        {isNewSession ? (
          <NewSessionHero>
            <PiComposer variant="centered" />
          </NewSessionHero>
        ) : (
          <>
            <ThreadPrimitive.Root className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <ThreadPrimitive.Viewport className="chat-scroll-zone min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="flex flex-col gap-3">
                  <ThreadPrimitive.Messages>{() => <ShellMessage />}</ThreadPrimitive.Messages>
                </div>
              </ThreadPrimitive.Viewport>
              <div className="chat-scroll-jump pointer-events-none absolute inset-x-0 z-50">
                <JumpToLatest streaming={snapshot.streaming} />
              </div>
            </ThreadPrimitive.Root>
            <div ref={bottomDockRef} className="chat-bottom-dock">
              <StreamingStatusBar />
              <PiComposer />
            </div>
          </>
        )}
      </LineMapContext.Provider>
    </AssistantRuntimeProvider>
  );
}
