import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type VariantProps } from "class-variance-authority"
import { ChevronDown } from "lucide-react"
import { useStickToBottomContext } from "use-stick-to-bottom"

export type ScrollButtonProps = {
  className?: string
  variant?: VariantProps<typeof buttonVariants>["variant"]
  size?: VariantProps<typeof buttonVariants>["size"]
  streaming?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function ScrollButton({
  className,
  variant = "outline",
  size = "sm",
  streaming = false,
  ...props
}: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "gap-1.5 rounded-full transition-all duration-150 ease-out",
        size === "icon" || size === "icon-sm" ? "h-10 w-10" : "h-9 px-3",
        !isAtBottom
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
        className
      )}
      aria-label={
        streaming ? "Jump to latest response" : "Jump to latest messages"
      }
      title={streaming ? "Jump to latest response" : "Jump to latest messages"}
      onClick={() => {
        scrollToBottom({ animation: "smooth" })
      }}
      {...props}
    >
      {streaming && !isAtBottom && (
        <span
          className="size-2 shrink-0 animate-pulse rounded-full bg-graphite"
          aria-hidden
        />
      )}
      <ChevronDown className="h-5 w-5 shrink-0" />
      {size !== "icon" && size !== "icon-sm" && (
        <span className="text-[12px] font-medium">Latest</span>
      )}
    </Button>
  )
}

export { ScrollButton }
