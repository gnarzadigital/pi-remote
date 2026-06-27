import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePiBridge } from "@/hooks/use-pi-bridge";

export function ExtensionDialog() {
  const { snapshot, bridge } = usePiBridge();
  const d = snapshot.extensionDialog;
  const [input, setInput] = useState("");
  const [editor, setEditor] = useState("");

  if (!d) return null;

  const open = Boolean(d);
  const initialInput = d.inputValue ?? "";
  const initialEditor = d.editorValue ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) bridge.resolveExtensionDialog(null, true);
      }}
    >
      <DialogContent onOpenAutoFocus={() => {
        setInput(initialInput);
        setEditor(initialEditor);
      }}>
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
            value={editor || initialEditor}
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
                bridge.resolveExtensionDialog(d.showEditor ? editor : input || true)
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
