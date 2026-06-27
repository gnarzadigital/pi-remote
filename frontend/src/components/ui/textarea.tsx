import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[44px] w-full rounded-[10px] border border-hairline bg-chalk px-3 py-2.5 text-sm text-graphite placeholder:text-concrete focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-graphite/10 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
