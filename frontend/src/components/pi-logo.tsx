import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
};

/** Pixel π app mark — same asset as PWA / favicon. */
export function PiLogo({ size = 28, className }: Props) {
  return (
    <img
      src="/icon-192.png"
      alt="pi"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[8px]", className)}
      draggable={false}
    />
  );
}
