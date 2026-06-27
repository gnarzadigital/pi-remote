import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-transform duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-graphite/20 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-graphite text-chalk hover:bg-graphite/90 rounded-[10px]",
        ghost: "text-graphite hover:bg-mist rounded-[10px]",
        outline: "border border-hairline bg-chalk text-graphite hover:bg-mist rounded-[10px]",
        destructive: "border border-hairline text-graphite hover:bg-mist rounded-[10px]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
        xs: "h-7 px-2.5 text-[12px]",
        icon: "size-9 rounded-[10px]",
        "icon-sm": "size-8 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
