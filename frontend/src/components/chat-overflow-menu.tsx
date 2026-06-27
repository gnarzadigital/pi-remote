import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { formatSessionMeta, getModelContextWindowTokens } from "@/lib/message-utils";
import { isPinned, togglePin } from "@/lib/pinned-sessions";
import { markSessionUnread } from "@/lib/session-read-state";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

export function ChatOverflowMenu({ onRename }: { onRename?: () => void }) {
  const { snapshot, bridge } = usePiBridge();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(snapshot.activeSessionPath ? isPinned(snapshot.activeSessionPath) : false);
  }, [snapshot.activeSessionPath]);

  const contextWindow = getModelContextWindowTokens(
    (snapshot.activeModel ?? null) as Record<string, unknown> | null
  );
  const sessionMeta = formatSessionMeta(snapshot.connected, snapshot.stats, contextWindow);
  const workspace = snapshot.sessionInfo;
  const hasInfo = workspace || sessionMeta;
  const canPin = Boolean(snapshot.activeSessionPath);

  const handleTogglePin = () => {
    if (!snapshot.activeSessionPath) return;
    const nowPinned = togglePin(snapshot.activeSessionPath);
    setPinned(nowPinned);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasInfo ? (
          <>
            {workspace ? (
              <DropdownMenuLabel className="font-normal normal-case tracking-normal text-[12px] text-graphite">
                {workspace}
              </DropdownMenuLabel>
            ) : null}
            {sessionMeta ? (
              <DropdownMenuLabel className="font-normal normal-case tracking-normal text-[12px] text-concrete">
                {sessionMeta}
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {canPin ? (
          <>
            <DropdownMenuItem onClick={handleTogglePin}>
              {pinned ? "Unpin session" : "Pin session"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename?.()}>Rename session</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (snapshot.activeSessionPath) markSessionUnread(snapshot.activeSessionPath);
              }}
            >
              Mark as unread
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => bridge.exportConversation()}>Export</DropdownMenuItem>
        <DropdownMenuItem onClick={() => bridge.compact()}>Compact context</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
