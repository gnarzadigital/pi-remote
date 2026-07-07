import { useMemo } from "react";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { SpikeToolPart } from "@/components/spike/spike-tool-part";
import { chatLinesToThreadMessages } from "@/lib/assistant-ui-adapter";
import { usePiBridge } from "@/hooks/use-pi-bridge";

/**
 * Spike proof: assistant-ui's Thread/Composer/Message primitives, wired to
 * pi-remote's REAL bridge state via ExternalStoreRuntime — not a mock. Reads
 * the exact same `snapshot.lines`/`snapshot.streaming` the production
 * ConversationView reads; `onNew` calls the exact same `bridge.sendMessage`
 * production send path. No backend/reducer changes.
 */
export function SpikeThread() {
  const { snapshot, bridge } = usePiBridge();
  const messages = useMemo(() => chatLinesToThreadMessages(snapshot.lines), [snapshot.lines]);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: snapshot.streaming,
    // `messages` is already in the loose ThreadMessageLike shape (produced by
    // the adapter), not the internal ThreadMessage type — TS requires this
    // identity converter whenever T doesn't literally extend ThreadMessage.
    convertMessage: (m) => m,
    onNew: async (msg) => {
      const text = msg.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) bridge.sendMessage(text);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread components={{ ToolFallback: SpikeToolPart }} />
    </AssistantRuntimeProvider>
  );
}
