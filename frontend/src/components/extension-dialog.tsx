import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { isSpikeMode } from "@/lib/spike-mode";

export function ExtensionDialog() {
  const { snapshot, bridge } = usePiBridge();
  const d = snapshot.extensionDialog;
  const [input, setInput] = useState("");
  const [editor, setEditor] = useState("");

  // Reset values whenever dialog identity changes (not just on focus)
  const dialogKey = d ? `${d.id ?? ""}-${d.title}` : "";
  useEffect(() => {
    if (!d) return;
    setInput(d.inputValue ?? "");
    setEditor(d.editorValue ?? "");
  }, [dialogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null;

  // Primary-session dialogs (no agentId) render inline in the transcript
  // instead (4.2's InlineExtensionDialog in pi-chat-shell.tsx) whenever the
  // assistant-ui shell is actually the thing on screen. Everything else
  // (attached-agent dialogs, non-spike ChatView, sessions view) still needs
  // this modal.
  if (!d.agentId && isSpikeMode() && snapshot.view === "chat") return null;

  const open = Boolean(d);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) bridge.resolveExtensionDialog(null, true);
      }}
    >
      <DialogContent>
        <DialogTitle>{d.title}</DialogTitle>
        {d.message && <p className="text-sm text-concrete">{d.message}</p>}
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
      </DialogContent>
    </Dialog>
  );
}
