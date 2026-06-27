import { useEffect } from "react";
import { ChatView } from "@/components/chat-view";
import { ExtensionDialog } from "@/components/extension-dialog";
import { SessionsView } from "@/components/sessions-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { cn } from "@/lib/utils";
import { piBridge } from "@/lib/pi-bridge-client";

function AppShell() {
  const { snapshot } = usePiBridge();
  const onChat = snapshot.view === "chat";
  const hasChat = onChat || snapshot.lines.length > 0;

  return (
    <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-1 md:grid-cols-[min(360px,40vw)_1fr]">
      {/* Sessions — full screen on mobile when not in chat */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col border-hairline md:border-r",
          onChat ? "hidden md:flex" : "flex"
        )}
      >
        <SessionsView />
      </div>

      {/* Chat — full screen on mobile when in chat */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          onChat ? "flex" : "hidden md:flex"
        )}
      >
        {hasChat ? (
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

export default function App() {
  const { snapshot } = usePiBridge();
  useVisualViewport();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", snapshot.theme === "dark");
  }, [snapshot.theme]);

  useEffect(() => {
    piBridge.connect();
    piBridge.fetchSessions();
  }, []);

  return (
    <TooltipProvider>
      <div className="app-shell flex h-[var(--app-height,100dvh)] w-full min-w-0 flex-col overflow-hidden bg-canvas text-graphite font-sans antialiased">
        <AppShell />
        <ExtensionDialog />
      </div>
    </TooltipProvider>
  );
}
