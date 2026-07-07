import type { ReactNode } from "react";
import { PiLogo } from "@/components/pi-logo";

/** Centered hero for a brand-new (unsaved) session — no messages, no session
 * path yet. The composer is injected so both the production InputArea and the
 * assistant-ui PiComposer can live inside the same hero. */
export function NewSessionHero({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 pb-6">
      <PiLogo size={40} />
      <div className="text-center">
        <p className="text-[16px] font-medium text-graphite">What can I help with?</p>
        <p className="mt-1 text-[13px] text-concrete">Ask anything, run commands, or explore files.</p>
      </div>
      <div className="w-full max-w-[440px]">{children}</div>
    </div>
  );
}
