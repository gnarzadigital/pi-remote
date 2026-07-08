import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useAuiState,
  useExternalStoreRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import { ChevronDown, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversationLine } from "@/components/conversation-view";
import { ErrorBoundary } from "@/components/error-boundary";
import { NewSessionHero } from "@/components/new-session-hero";
import { PiComposer } from "@/components/assistant-ui/pi-composer";
import { StreamingStatusBar } from "@/components/streaming-status-bar";
import { chatLinesToThreadMessages } from "@/lib/assistant-ui-adapter";
import { piThreadListAdapter } from "@/lib/remote-thread-list-adapter";
import { useChatBottomInset } from "@/hooks/use-chat-bottom-inset";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { ChatLine } from "@/lib/types";

/** message id (== ChatLine id, set by the adapter) -> the live ChatLine, so
 * each assistant-ui message renders through the EXACT production renderer
 * (ConversationLine: markdown, thinking chain, tool cards, diff viewer,
 * system banners) — the "bespoke renderers stay plug-ins" half of D-3. */
const LineMapContext = createContext<Map<string, ChatLine>>(new Map());

const actionButtonClass =
  "inline-flex size-6 items-center justify-center rounded-full text-concrete hover:bg-mist hover:text-graphite disabled:pointer-events-none disabled:opacity-40";

/** Edit-and-resubmit (4.1): the user-message textarea swaps in for the static
 * bubble while editing; assistant-ui's edit composer pre-fills it with the
 * message's current text. Save resubmits via `onEdit` -> the same bridge
 * send path as a normal message (see the onEdit comment in AssistantChatShell
 * for why this can't be a true in-place history rewind against pi). */
function EditingMessage() {
  return (
    <ComposerPrimitive.Root className="flex flex-col items-end gap-1 py-1">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        className="max-h-[140px] w-full max-w-[92%] resize-none rounded-[14px] border border-hairline bg-canvas px-3 py-2.5 text-[14px] text-graphite outline-none"
      />
      <div className="flex items-center gap-3 pr-1">
        <ComposerPrimitive.Cancel className="text-[12px] text-concrete hover:text-graphite">
          Cancel
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send className="text-[12px] font-medium text-graphite hover:text-graphite">
          Save
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}

function ShellMessage() {
  const id = useAuiState((s) => s.message.id);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const line = useContext(LineMapContext).get(id);
  if (!line) return null;
  if (isEditing) return <EditingMessage />;
  return (
    <ErrorBoundary inline>
      <ConversationLine line={line} />
      {role === "user" && (
        <div className="flex justify-end">
          <ActionBarPrimitive.Edit aria-label="Edit message" className={actionButtonClass}>
            <Pencil className="size-3.5" />
          </ActionBarPrimitive.Edit>
        </div>
      )}
      {role === "assistant" && line.kind === "turn" && !line.streaming && (
        <div className="flex justify-start">
          <ActionBarPrimitive.Reload aria-label="Regenerate response" className={actionButtonClass}>
            <RotateCcw className="size-3.5" />
          </ActionBarPrimitive.Reload>
        </div>
      )}
    </ErrorBoundary>
  );
}

/** Ported ChatView had ChatScrollController's sr-only aria-live region
 * (announces "still responding" to screen readers); that component is tied
 * to use-stick-to-bottom's context, which this shell doesn't use
 * (ThreadPrimitive.Viewport is its own scroll engine), so it can't be reused
 * as-is. This keeps the same accessibility signal without that dependency. */
function StreamingLiveRegion({ streaming }: { streaming: boolean }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {streaming ? "Assistant is responding" : ""}
    </div>
  );
}

/**
 * Inline re-skin of ExtensionDialog (4.2): pi's own tool-permission /
 * input / editor gate (extension_ui_request, already wired through
 * pi-bridge-client's extensionDialog state) rendered as the last item in the
 * transcript instead of a blocking modal. Only handles primary-session
 * dialogs (no agentId) — attached-agent dialogs still use the global modal
 * in App.tsx, since this shell never renders agent-chat. "Turn position" is
 * simply the end of the transcript: pi blocks on this response before the
 * current turn can continue, so nothing else can arrive above it meanwhile.
 */
function InlineExtensionDialog() {
  const { snapshot, bridge } = usePiBridge();
  const d = snapshot.extensionDialog;
  const [input, setInput] = useState("");
  const [editor, setEditor] = useState("");

  const dialogKey = d ? `${d.id ?? ""}-${d.title}` : "";
  useEffect(() => {
    if (!d) return;
    setInput(d.inputValue ?? "");
    setEditor(d.editorValue ?? "");
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d || d.agentId) return null;

  return (
    <div
      role="alertdialog"
      aria-label={d.title}
      className="flex flex-col gap-2 rounded-[14px] border border-hairline bg-card p-3"
    >
      <p className="text-[14px] font-medium text-graphite">{d.title}</p>
      {d.message && <p className="text-[13px] text-concrete">{d.message}</p>}
      {d.options?.map((opt) => (
        <Button
          key={opt}
          variant="outline"
          className="w-full justify-start"
          onClick={() => bridge.resolveExtensionDialog(opt)}
        >
          {opt}
        </Button>
      ))}
      {d.showEditor && (
        <textarea
          className="min-h-[120px] w-full rounded-[10px] border border-hairline p-2 font-mono text-sm"
          value={editor}
          onChange={(e) => setEditor(e.target.value)}
        />
      )}
      {d.showInput && !d.showEditor && (
        <input
          className="w-full rounded-[10px] border border-hairline px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      )}
      {d.showConfirm && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => bridge.resolveExtensionDialog(null, true)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              bridge.resolveExtensionDialog(d.showEditor ? editor : input ?? "")
            }
          >
            OK
          </Button>
        </div>
      )}
    </div>
  );
}

function JumpToLatest({ streaming }: { streaming: boolean }) {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button
        variant="outline"
        size="icon"
        aria-label={streaming ? "Jump to latest response" : "Jump to latest messages"}
        className="pointer-events-auto ml-auto mr-4 h-10 w-10 rounded-full border-hairline bg-card shadow-md transition-all duration-150 ease-out disabled:pointer-events-none disabled:translate-y-4 disabled:scale-95 disabled:opacity-0"
      >
        <ChevronDown className="h-5 w-5 shrink-0" />
      </Button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

/**
 * The underlying per-thread runtime, backing whichever thread
 * useRemoteThreadListRuntime currently has active. Session switching itself
 * happens via bridge.switchSession() elsewhere (sessions-view.tsx, which
 * renders outside this shell's provider) — snapshot.lines/streaming already
 * reflect whatever session pi has loaded, so this only projects that live
 * state into ThreadMessageLike, same as before the thread-list runtime swap.
 * Passed as `runtimeHook` to useRemoteThreadListRuntime, which calls it as a
 * normal hook for the active thread.
 */
function usePiThreadRuntime() {
  const { snapshot, bridge } = usePiBridge();
  const messages = useMemo(() => chatLinesToThreadMessages(snapshot.lines), [snapshot.lines]);

  return useExternalStoreRuntime({
    messages,
    isRunning: snapshot.streaming,
    // `messages` is already ThreadMessageLike (adapter output), not the
    // internal ThreadMessage type — TS requires this identity converter.
    convertMessage: (m) => m,
    onNew: async (msg) => {
      const text = msg.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) bridge.sendMessage(text);
    },
    // pi's bridge protocol has no "rewind agent context" primitive (see
    // bridge.ts: prompt/follow_up/steer only append). Editing a user message
    // or reloading an assistant reply can't truly replace what the agent
    // already ingested, so both resubmit as a new prompt instead of a true
    // in-place rewind. Open question logged in PLAN.md.
    onEdit: async (msg) => {
      const text = msg.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim();
      if (text) bridge.sendMessage(text);
    },
    onReload: async (parentId) => {
      const parent = parentId ? snapshot.lines.find((l) => l.id === parentId) : undefined;
      if (parent?.kind === "user") bridge.sendMessage(parent.text);
    },
  });
}

/**
 * assistant-ui chat shell (the ?spike=1 body of ChatView): RemoteThreadListRuntime
 * (4.4 — real, switchable .threads backed by piThreadListAdapter) wrapping the
 * ExternalStoreRuntime above, ThreadPrimitive viewport for the message list +
 * streaming/scroll mechanics, and the proven in-flow `.chat-bottom-dock`
 * (NOT position:fixed, NOT sticky ViewportFooter — the flex-last-child pattern
 * that survived the iOS standalone saga) hosting the assistant-ui composer.
 */
export function AssistantChatShell() {
  const { snapshot } = usePiBridge();
  const lineMap = useMemo(
    () => new Map(snapshot.lines.map((l): [string, ChatLine] => [l.id, l])),
    [snapshot.lines]
  );

  const runtime = useRemoteThreadListRuntime({
    runtimeHook: usePiThreadRuntime,
    adapter: piThreadListAdapter,
    threadId: snapshot.activeSessionPath ?? undefined,
  });

  // Same "black gap" rule as production ChatView: fresh, never-prompted
  // session (no path, no lines) centers the composer instead of docking it.
  const isNewSession = !snapshot.activeSessionPath && snapshot.lines.length === 0;
  const bottomDockRef = useRef<HTMLDivElement>(null);
  useChatBottomInset(bottomDockRef, !isNewSession);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <LineMapContext.Provider value={lineMap}>
        {isNewSession ? (
          <NewSessionHero>
            <PiComposer variant="centered" />
          </NewSessionHero>
        ) : (
          <>
            <ThreadPrimitive.Root className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <ThreadPrimitive.Viewport className="chat-scroll-zone min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="flex flex-col gap-3">
                  <ThreadPrimitive.Messages>{() => <ShellMessage />}</ThreadPrimitive.Messages>
                  <InlineExtensionDialog />
                </div>
              </ThreadPrimitive.Viewport>
              <div className="chat-scroll-jump pointer-events-none absolute inset-x-0 z-50">
                <JumpToLatest streaming={snapshot.streaming} />
              </div>
              <StreamingLiveRegion streaming={snapshot.streaming} />
            </ThreadPrimitive.Root>
            <div ref={bottomDockRef} className="chat-bottom-dock">
              <StreamingStatusBar />
              <PiComposer />
            </div>
          </>
        )}
      </LineMapContext.Provider>
    </AssistantRuntimeProvider>
  );
}
