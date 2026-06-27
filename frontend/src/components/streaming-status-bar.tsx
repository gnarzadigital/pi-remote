import { ThinkingBar } from "@/components/ui/thinking-bar"
import { usePiBridge } from "@/hooks/use-pi-bridge"
import { getStreamingLabel } from "@/lib/streaming-label"

/** Sticky shimmer bar above the input while the model is working. */
export function StreamingStatusBar() {
  const { snapshot, bridge } = usePiBridge()
  const label = getStreamingLabel(snapshot.lines, snapshot.streaming)
  if (!label) return null

  return (
    <div className="shrink-0 border-t border-hairline bg-canvas px-4 py-2">
      <ThinkingBar
        text={label}
        stopLabel="Stop"
        onStop={() => bridge.abort()}
      />
    </div>
  )
}
