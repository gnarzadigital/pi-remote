import { useSyncExternalStore } from "react";
import { piBridge } from "@/lib/pi-bridge-client";

export function usePiBridge() {
  const snapshot = useSyncExternalStore(
    piBridge.subscribe,
    piBridge.getSnapshot,
    piBridge.getSnapshot
  );
  return { snapshot, bridge: piBridge };
}
