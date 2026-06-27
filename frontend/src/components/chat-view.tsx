import { ChevronLeft, MoreHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConversationView } from "@/components/conversation-view";
import { InputArea } from "@/components/input-area";
import { SettingsPanel } from "@/components/settings-panel";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

export function ChatView() {
  const { snapshot, bridge } = usePiBridge();
  const modelLabel = snapshot.activeModel?.name ?? snapshot.activeModel?.id ?? "pi remote";

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline px-3 pt-[max(env(safe-area-inset-top),8px)]">
        <div className="flex h-10 items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center text-[14px] text-graphite hover:opacity-70"
            onClick={() => {
              hapticTap();
              bridge.setView("sessions");
            }}
          >
            <ChevronLeft className="size-4" />
            <span>Sessions</span>
          </button>
          <div className="min-w-0 flex-1 truncate text-center text-[14px] font-medium text-graphite">
            {modelLabel}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => bridge.exportConversation()}>Export</DropdownMenuItem>
              <DropdownMenuItem onClick={() => bridge.compact()}>Compact context</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        </div>
        <p className="pb-2 text-center text-[12px] text-concrete">{bridge.getStatusText()}</p>
      </header>

      <ConversationView />
      <InputArea />
    </div>
  );
}
