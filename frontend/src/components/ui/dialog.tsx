import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/10 backdrop-blur-[1px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[14px] border border-hairline bg-chalk p-4 shadow-none",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 rounded-[10px] p-1 text-concrete hover:bg-mist">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-graphite pr-6", className)}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogTitle };
