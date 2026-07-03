import { ChevronLeft, GitBranch, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatOverflowMenu } from "@/components/chat-overflow-menu";
import { ConversationView } from "@/components/conversation-view";
import { InputArea } from "@/components/input-area";
import { PiLogo } from "@/components/pi-logo";
import { ScreenHeader } from "@/components/screen-header";
import { SessionRenameSheet } from "@/components/session-rename-sheet";
import { StreamingStatusBar } from "@/components/streaming-status-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

/** Centered hero for a brand-new (unsaved) session — no messages, no session path yet. */
function NewSessionHero() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 pb-6">
      <PiLogo size={40} />
      <div className="text-center">
        <p className="text-[16px] font-medium text-graphite">What can I help with?</p>
        <p className="mt-1 text-[13px] text-concrete">Ask anything, run commands, or explore files.</p>
      </div>
      <div className="w-full max-w-[440px]">
        <InputArea variant="centered" />
      </div>
    </div>
  );
}

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
  useChatBottomInset(bottomDockRef, !isNewSession);

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

      {isNewSession ? (
        <NewSessionHero />
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
