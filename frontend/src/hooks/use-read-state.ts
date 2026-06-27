import { useSyncExternalStore } from "react";
import { subscribeReadState } from "@/lib/session-read-state";

/** Re-render when read/unread state changes in localStorage. */
export function useReadState() {
  return useSyncExternalStore(subscribeReadState, () => Date.now(), () => 0);
}
