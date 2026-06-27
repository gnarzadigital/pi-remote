"use client"

import { cn } from "@/lib/utils"

export type TextShimmerProps = {
  duration?: number
  spread?: number
  children: React.ReactNode
  className?: string
}

export function TextShimmer({
  className,
  duration = 4,
  spread = 20,
  children,
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45)

  return (
    <span
      className={cn(
        "bg-size-[200%_auto] bg-clip-text font-medium text-transparent",
        "animate-[shimmer_4s_infinite_linear]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, var(--color-concrete) ${50 - dynamicSpread}%, var(--color-graphite) 50%, var(--color-concrete) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </span>
  )
}
