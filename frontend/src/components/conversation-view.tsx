import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { Message, MessageContent } from "@/components/ui/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ui/reasoning";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Tool } from "@/components/ui/tool";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { mapToolBlock } from "@/lib/tool-part-mapper";
import type { ChatLine, TurnBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

const messageContentClass =
  "rounded-[14px] border border-hairline bg-card px-3 py-2.5 text-[14px] leading-relaxed text-graphite prose prose-sm max-w-none break-words [overflow-wrap:anywhere] dark:prose-invert prose-pre:bg-mist prose-pre:border prose-pre:border-hairline prose-code:bg-mist prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none";

const userContentClass =
  "max-w-[92%] rounded-[14px] border border-hairline bg-mist px-3 py-2.5 text-[14px] text-graphite";

function ThinkingBlock({ block }: { block: Extract<TurnBlock, { kind: "thinking" }> }) {
  return (
    <Reasoning isStreaming={block.streaming} className="my-1">
      <ReasoningTrigger className="text-[12px] text-concrete hover:text-graphite">
        Thinking{block.streaming ? "…" : ""}
      </ReasoningTrigger>
      <ReasoningContent
        markdown
        contentClassName="mt-1 max-h-48 overflow-auto rounded-[10px] border border-hairline bg-mist p-2 font-mono text-[12px] text-concrete prose-sm dark:prose-invert"
      >
        {block.text}
      </ReasoningContent>
    </Reasoning>
  );
}

function TurnLine({ line }: { line: Extract<ChatLine, { kind: "turn" }> }) {
  return (
    <Message className="flex-col gap-1 py-1">
      <span className="text-[11px] font-medium text-concrete">
        {line.streaming ? "Assistant" : "Assistant"}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {line.blocks.map((block, i) => {
          if (block.kind === "text") {
            return (
              <MessageContent
                key={i}
                markdown
                className={cn(messageContentClass, "w-full max-w-full overflow-hidden")}
              >
                {block.text + (block.streaming ? " ▍" : "")}
              </MessageContent>
            );
          }
          if (block.kind === "thinking") {
            return <ThinkingBlock key={i} block={block} />;
          }
          if (block.kind === "tool") {
            return (
              <Tool
                key={i}
                toolPart={mapToolBlock(block)}
                className="tool-card-monochrome mt-0 border-hairline bg-mist"
              />
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
                <p key={line.id} className="my-1 text-center text-[12px] text-concrete italic">
                  {line.text}
                </p>
              );
            }
            if (line.kind === "error") {
              return (
                <p key={line.id} className="my-1 text-center text-[12px] text-graphite">
                  {line.text}
                </p>
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
