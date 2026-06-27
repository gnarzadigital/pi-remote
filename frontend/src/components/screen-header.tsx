import { cn } from "@/lib/utils";

type ScreenHeaderProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
};

/** Safe-area top + symmetric vertical padding above the hairline border. */
export function ScreenHeader({ children, className, innerClassName }: ScreenHeaderProps) {
  return (
    <header className={cn("screen-header shrink-0 border-b border-hairline bg-canvas", className)}>
      <div className={cn("screen-header-inner flex items-center gap-2", innerClassName)}>
        {children}
      </div>
    </header>
  );
}

/** Secondary strip directly under a screen header (connection, connecting, etc.). */
export function ScreenSubstrip({ children, className }: ScreenHeaderProps) {
  return (
    <div className={cn("screen-substrip shrink-0 border-b border-hairline bg-canvas", className)}>
      {children}
    </div>
  );
}
