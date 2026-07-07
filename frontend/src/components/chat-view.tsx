import { ChevronLeft, GitBranch, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AssistantChatShell } from "@/components/assistant-ui/pi-chat-shell";
import { ChatOverflowMenu } from "@/components/chat-overflow-menu";
import { ConversationView } from "@/components/conversation-view";
import { InputArea } from "@/components/input-area";
import { NewSessionHero } from "@/components/new-session-hero";
import { ScreenHeader } from "@/components/screen-header";
import { SessionRenameSheet } from "@/components/session-rename-sheet";
import { StreamingStatusBar } from "@/components/streaming-status-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { isSpikeMode } from "@/lib/spike-mode";
import { hapticTap } from "@/lib/utils";

export function ChatView() {
  const { snapshot, bridge } = usePiBridge();
  const [renameOpen, setRenameOpen] = useState(false);
  const bottomDockRef = useRef<HTMLDivElement>(null);
  const sessionTitle = snapshot.activeSessionName ?? "New session";
  const canRename = Boolean(snapshot.activeSessionPath);
  // A real session always has a path once loaded; no path + no lines = a fresh,
  // never-prompted session. Center the composer instead of pinning it below a
  // blank transcript (the "black gap" — dock chrome with nothing above it).
  const isNewSession = !snapshot.activeSessionPath && snapshot.lines.length === 0;
  const spike = isSpikeMode();
  // In spike mode AssistantChatShell owns the dock + inset itself.
  useChatBottomInset(bottomDockRef, !spike && !isNewSession);

  return (
    <div className="chat-view-root flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <ScreenHeader innerClassName="gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] shrink-0 items-center text-[14px] text-graphite hover:opacity-70"
          onClick={() => {
            hapticTap();
            bridge.setView("sessions");
          }}
        >
          <ChevronLeft className="size-4" />
          <span>Sessions</span>
        </button>
        <button
          type="button"
          disabled={!canRename}
          className="flex min-w-0 flex-1 flex-col items-center justify-center disabled:opacity-100"
          onClick={() => {
            if (!canRename) return;
            hapticTap();
            setRenameOpen(true);
          }}
        >
          <span className="max-w-full truncate text-[14px] font-medium text-graphite">
            {sessionTitle}
          </span>
          {snapshot.gitBranch && (
            <span className="flex max-w-full items-center gap-1 truncate text-[11px] font-normal text-concrete">
              <GitBranch className="size-3 shrink-0" />
              <span className="truncate">{snapshot.gitBranch}</span>
            </span>
          )}
        </button>
        <ChatOverflowMenu onRename={() => setRenameOpen(true)} />
        <SettingsPanel />
        {snapshot.streaming && (
          <Button variant="outline" size="icon-sm" aria-label="Stop" onClick={() => bridge.abort()}>
            <Square className="size-3.5 fill-current" />
          </Button>
        )}
      </ScreenHeader>

      {spike ? (
        <AssistantChatShell />
      ) : isNewSession ? (
        <NewSessionHero>
          <InputArea variant="centered" />
        </NewSessionHero>
      ) : (
        <>
          <ConversationView />
          <div ref={bottomDockRef} className="chat-bottom-dock">
            <StreamingStatusBar />
            <InputArea />
          </div>
        </>
      )}

      {canRename && snapshot.activeSessionPath ? (
        <SessionRenameSheet
          open={renameOpen}
          initialName={sessionTitle === "New session" ? "" : sessionTitle}
          onOpenChange={setRenameOpen}
          onSave={(name) => bridge.renameSession(snapshot.activeSessionPath!, name)}
        />
      ) : null}
    </div>
  );
}
