import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Loader } from "@/components/ui/loader";
import { Message, MessageContent } from "@/components/ui/message";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Steps, StepsContent, StepsItem, StepsTrigger } from "@/components/ui/steps";
import { SystemMessage } from "@/components/ui/system-message";
import { Tool } from "@/components/ui/tool";
import { ThinkingChain } from "@/components/thinking-chain";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { groupTurnBlocks } from "@/lib/block-groups";
import { mapToolBlock } from "@/lib/tool-part-mapper";
import type { ChatLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Wrench } from "lucide-react";

const messageContentClass =
  "rounded-[14px] border border-hairline bg-card px-3 py-2.5 text-[14px] leading-relaxed text-graphite prose prose-sm max-w-none break-words [overflow-wrap:anywhere] dark:prose-invert prose-pre:bg-mist prose-pre:border prose-pre:border-hairline prose-code:bg-mist prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none";

const userContentClass =
  "max-w-[92%] rounded-[14px] border border-hairline bg-mist px-3 py-2.5 text-[14px] text-graphite";

function TurnLine({ line }: { line: Extract<ChatLine, { kind: "turn" }> }) {
  const { bridge } = usePiBridge();
  const groups = groupTurnBlocks(line.blocks);

  return (
    <Message className="flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-concrete">Assistant</span>
        {line.streaming && (
          <Loader variant="text-shimmer" size="sm" text="Responding" className="text-concrete" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {groups.map((group, gi) => {
          if (group.kind === "thinking") {
            return (
              <ThinkingChain
                key={`think-${gi}`}
                blocks={group.blocks}
                onStop={line.streaming ? () => bridge.abort() : undefined}
              />
            );
          }
          if (group.kind === "text") {
            const block = group.block;
            return (
              <MessageContent
                key={`text-${gi}`}
                markdown
                className={cn(messageContentClass, "w-full max-w-full overflow-hidden")}
              >
                {block.text + (block.streaming ? " ▍" : "")}
              </MessageContent>
            );
          }
          if (group.kind === "tools") {
            const running = group.blocks.some((b) => b.status === "running");
            if (group.blocks.length === 1) {
              return (
                <Tool
                  key={`tool-${gi}`}
                  toolPart={mapToolBlock(group.blocks[0])}
                  className="mt-0 border-hairline bg-mist"
                />
              );
            }
            return (
              <Steps key={`tools-${gi}`} defaultOpen={running} className="rounded-[10px] border border-hairline bg-mist px-3 py-2">
                <StepsTrigger
                  leftIcon={<Wrench className="size-3.5" />}
                  className="text-[13px] text-concrete hover:text-graphite"
                >
                  Tool runs ({group.blocks.length})
                </StepsTrigger>
                <StepsContent>
                  {group.blocks.map((block, ti) => (
                    <StepsItem key={ti} className="py-1">
                      <Tool toolPart={mapToolBlock(block)} className="mt-0 border-hairline bg-chalk" />
                    </StepsItem>
                  ))}
                </StepsContent>
              </Steps>
            );
          }
          return null;
        })}
      </div>
    </Message>
  );
}

export function ConversationView() {
  const { snapshot } = usePiBridge();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatContainerRoot className="min-h-0 flex-1 w-full min-w-0 overscroll-contain px-4 py-3">
        <ChatContainerContent className="gap-3">
          {snapshot.lines.map((line) => {
            if (line.kind === "user") {
              return (
                <Message key={line.id} className="flex-col items-end gap-1">
                  <span className="text-[11px] text-concrete">You</span>
                  <MessageContent className={userContentClass}>{line.text}</MessageContent>
                </Message>
              );
            }
            if (line.kind === "system") {
              return (
                <SystemMessage
                  key={line.id}
                  variant="action"
                  fill
                  className="border-hairline bg-mist text-graphite"
                >
                  {line.text}
                </SystemMessage>
              );
            }
            if (line.kind === "error") {
              return (
                <SystemMessage
                  key={line.id}
                  variant="error"
                  fill
                  className="border-hairline bg-mist text-graphite"
                >
                  {line.text}
                </SystemMessage>
              );
            }
            return <TurnLine key={line.id} line={line} />;
          })}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <div className="pointer-events-none absolute right-4 bottom-20 z-10 md:bottom-4">
          <ScrollButton
            variant="outline"
            size="icon"
            className="pointer-events-auto border-hairline bg-chalk shadow-sm"
            aria-label="Scroll to bottom"
          />
        </div>
      </ChatContainerRoot>
    </div>
  );
}
