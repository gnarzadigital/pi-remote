import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Message, MessageContent } from "@/components/ui/message";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Steps, StepsContent, StepsItem, StepsTrigger } from "@/components/ui/steps";
import { SystemMessage } from "@/components/ui/system-message";
import { Tool } from "@/components/ui/tool";
import { DiffView } from "@/components/ui/diff";
import { parseEditArgs } from "@/lib/diff-parse";
import { ChatScrollController } from "@/components/chat-scroll-controller";
import { ThinkingChain } from "@/components/thinking-chain";
import { ErrorBoundary } from "@/components/error-boundary";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { groupTurnBlocks } from "@/lib/block-groups";
import { mapToolBlock } from "@/lib/tool-part-mapper";
import type { ChatLine, TurnBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Wrench } from "lucide-react";

// Assistant prose = the same sans as the rest of the UI (Inter). One font family
// everywhere; code/pre stay mono via the typography plugin's own font-family.
const messageContentClass =
  "max-w-full min-w-0 overflow-x-clip rounded-[14px] border border-hairline bg-card px-3 py-2.5 chat-prose-text leading-[1.6] font-sans text-graphite prose prose-sm max-w-none break-words [overflow-wrap:anywhere] dark:prose-invert prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:bg-mist prose-pre:border prose-pre:border-hairline prose-pre:font-mono prose-code:font-mono prose-code:break-all prose-code:bg-mist prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-table:my-0";

// User bubble = same sans, explicit so it never inherits anything else.
const userContentClass =
  "max-w-[92%] rounded-[14px] border border-hairline bg-mist px-3 py-2.5 chat-user-text font-sans text-graphite";

/** edit/write tool with parseable args → render as an inline diff. */
function isDiffTool(block: Extract<TurnBlock, { kind: "tool" }>): boolean {
  return (block.name === "edit" || block.name === "write") && parseEditArgs(block.args) !== null;
}

function lineAnchorProps(lineId: string) {
  return {
    id: `chat-line-${lineId}`,
    "data-line-id": lineId,
    className: "scroll-mt-3",
  };
}

function TurnLine({ line }: { line: Extract<ChatLine, { kind: "turn" }> }) {
  const groups = groupTurnBlocks(line.blocks);

  return (
    <Message
      {...lineAnchorProps(line.id)}
      className="flex-col gap-1 py-1 min-w-0 max-w-full"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-concrete">Assistant</span>
        {line.streaming && (
          <TextShimmer className="text-[11px]">Responding</TextShimmer>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {groups.map((group, gi) => {
          if (group.kind === "thinking") {
            return (
              <ThinkingChain
                key={`think-${gi}`}
                blocks={group.blocks}
              />
            );
          }
          if (group.kind === "text") {
            const block = group.block;
            return (
              <MessageContent
                key={`text-${gi}`}
                markdown
                className={cn(messageContentClass, "w-full max-w-full")}
              >
                {block.text + (block.streaming ? " ▋" : "")}
              </MessageContent>
            );
          }
          if (group.kind === "tools") {
            const running = group.blocks.some((b) => b.status === "running");
            if (group.blocks.length === 1) {
              const b = group.blocks[0];
              if (isDiffTool(b)) {
                return <DiffView key={`tool-${gi}`} name={b.name} args={b.args} />;
              }
              return (
                <Tool
                  key={`tool-${gi}`}
                  toolPart={mapToolBlock(b)}
                  className="mt-0 border-hairline bg-mist"
                />
              );
            }
            return (
              <Steps key={`tools-${gi}`} defaultOpen={running} className="rounded-[10px] border border-hairline bg-mist px-3 py-2">
                <StepsTrigger
                  leftIcon={<Wrench className="size-3.5" />}
                  className="text-[12px] text-concrete hover:text-graphite"
                >
                  Activity · {group.blocks.length} tools
                </StepsTrigger>
                <StepsContent>
                  {group.blocks.map((block) => (
                    <StepsItem key={block.id} className="py-1">
                      {isDiffTool(block) ? (
                        <DiffView name={block.name} args={block.args} />
                      ) : (
                        <Tool toolPart={mapToolBlock(block)} className="mt-0 border-hairline bg-chalk" />
                      )}
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

export function ConversationLine({ line }: { line: ChatLine }) {
  if (line.kind === "user") {
    return (
      <Message
        {...lineAnchorProps(line.id)}
        className="flex-col items-end gap-1"
      >
        <span className="text-[11px] text-concrete">You</span>
        <MessageContent className={userContentClass}>{line.text}</MessageContent>
        {line.images && line.images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {line.images.map((img, i) => (
              <img key={i} src={img.preview ?? `data:${img.mimeType};base64,${img.data}`} alt="" className="max-h-32 rounded-lg" />
            ))}
          </div>
        )}
      </Message>
    );
  }
  if (line.kind === "system" || line.kind === "error") {
    return (
      <SystemMessage
        {...lineAnchorProps(line.id)}
        variant={line.kind === "error" ? "error" : "action"}
        fill
        className="border-hairline bg-mist text-graphite"
      >
        {line.text}
      </SystemMessage>
    );
  }
  return <TurnLine line={line} />;
}

type ConversationViewProps = {
  /** Override the primary snapshot's lines/streaming — used for the attached-agent
   * chat view (Phase 3.8-full), which renders a different agent's turn stream. */
  lines?: ChatLine[];
  streaming?: boolean;
};

export function ConversationView({ lines: linesOverride, streaming: streamingOverride }: ConversationViewProps = {}) {
  const { snapshot } = usePiBridge();
  const lines = linesOverride ?? snapshot.lines;
  const streaming = streamingOverride ?? snapshot.streaming;
  const isPrimary = linesOverride === undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatContainerRoot className="min-h-0 flex-1 w-full min-w-0 overscroll-contain px-4 py-3">
        {isPrimary && <ChatScrollController />}
        <ChatContainerContent className="gap-3">
          {lines.map((line) => (
            <ErrorBoundary key={line.id} inline>
              <ConversationLine line={line} />
            </ErrorBoundary>
          ))}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <div className="chat-scroll-jump pointer-events-none absolute inset-x-0 z-50">
          <ScrollButton
            variant="outline"
            size="icon"
            streaming={streaming}
            className="pointer-events-auto ml-auto mr-4 border-hairline bg-card shadow-md"
          />
        </div>
      </ChatContainerRoot>
    </div>
  );
}
