import { useEffect } from "react";
import { AgentChatView } from "@/components/agent-chat-view";
import { ChatView } from "@/components/chat-view";
import { DiagOverlay } from "@/components/diag-overlay";
import { ExtensionDialog } from "@/components/extension-dialog";
import { SessionsView } from "@/components/sessions-view";
import { StatusErrorToast } from "@/components/status-error-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { applyTheme, cn } from "@/lib/utils";
import { applyUiPrefs, getUiPrefs } from "@/lib/ui-prefs";
import { piBridge } from "@/lib/pi-bridge-client";

function AppShell() {
  const { snapshot } = usePiBridge();
  const onAgentChat = snapshot.view === "agent-chat";
  const onChat = snapshot.view === "chat" || onAgentChat;
  const hasChat = onChat || snapshot.lines.length > 0;

  return (
    <div className="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 md:grid-cols-[min(360px,40vw)_1fr]">
      {/* Sessions — full screen on mobile when not in chat */}
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col border-hairline md:border-r",
          onChat ? "hidden md:flex" : "flex"
        )}
      >
        <SessionsView />
      </div>

      {/* Chat — full screen on mobile when in chat */}
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col",
          onChat ? "flex" : "hidden md:flex"
        )}
      >
        {onAgentChat ? (
          <AgentChatView />
        ) : hasChat ? (
          <ChatView />
        ) : (
          <div className="hidden flex-1 items-center justify-center text-sm text-concrete md:flex">
            Select a session
          </div>
        )}
      </div>
    </div>
  );
}

/** assistant-ui port (?spike=1): the full AppShell renders either way — the
 * flag swaps ChatView's transcript+composer internals to the assistant-ui
 * shell (see chat-view.tsx / pi-chat-shell.tsx). */
export default function App() {
  const { snapshot } = usePiBridge();
  useVisualViewport();

  useEffect(() => {
    applyTheme(snapshot.theme);
  }, [snapshot.theme]);

  useEffect(() => {
    applyUiPrefs(getUiPrefs());
    piBridge.connect();
    piBridge.fetchSessions();
  }, []);

  return (
    <TooltipProvider>
      <ErrorBoundary>
        <div className="app-shell flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-canvas text-graphite font-sans antialiased">
          <AppShell />
          <StatusErrorToast />
          <ExtensionDialog />
          <DiagOverlay />
        </div>
      </ErrorBoundary>
    </TooltipProvider>
  );
}
