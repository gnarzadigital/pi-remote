import { ChevronLeft, GitBranch, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatOverflowMenu } from "@/components/chat-overflow-menu";
import { ConversationView } from "@/components/conversation-view";
import { InputArea } from "@/components/input-area";
import { ScreenHeader } from "@/components/screen-header";
import { SessionRenameSheet } from "@/components/session-rename-sheet";
import { StreamingStatusBar } from "@/components/streaming-status-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

export function ChatView() {
  const { snapshot, bridge } = usePiBridge();
  const [renameOpen, setRenameOpen] = useState(false);
  const bottomDockRef = useRef<HTMLDivElement>(null);
  useChatBottomInset(bottomDockRef);
  const sessionTitle = snapshot.activeSessionName ?? "New session";
  const canRename = Boolean(snapshot.activeSessionPath);

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
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!snapshot.streaming}
          aria-label="Stop"
          onClick={() => bridge.abort()}
        >
          <Square className="size-3.5 fill-current" />
        </Button>
      </ScreenHeader>

      <ConversationView />

      <div ref={bottomDockRef} className="chat-bottom-dock">
        <StreamingStatusBar />
        <InputArea />
      </div>

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
