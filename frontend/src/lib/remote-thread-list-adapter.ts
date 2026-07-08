import type { RemoteThreadListAdapter } from "@assistant-ui/react";
import { piBridge } from "@/lib/pi-bridge-client";
import { formatSessionName } from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";

function toMetadata(session: PiSession) {
  return {
    status: "regular" as const,
    remoteId: session.path,
    externalId: session.path,
    title: formatSessionName(session.name),
    lastMessageAt: new Date(session.mtime),
  };
}

/**
 * Backs ThreadListPrimitive/useRemoteThreadListRuntime off the live bridge
 * session list. Reads piBridge.getSnapshot() at call time (not a captured
 * React snapshot) so this object can stay a stable singleton instead of being
 * rebuilt every render.
 *
 * Session switching/renaming already happens through bridge.switchSession()/
 * renameSession() in sessions-view.tsx, independent of this adapter (that
 * view renders outside AssistantChatShell's provider, so there's no runtime
 * to call into from there) — this adapter exists so useRemoteThreadListRuntime
 * has a real, multi-item .threads to read and stays in sync via the
 * controlled `threadId` prop, not to own a second switching UI.
 */
export const piThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    return { threads: piBridge.getSnapshot().sessions.map(toMetadata) };
  },
  // Lazily invoked by assistant-ui the first time a message is sent into a
  // fresh/unpersisted thread (including the app's default entry state).
  // ensureActiveSession() joins an already-dispatched newSession() (e.g. from
  // the "+ New" button, which fires before this shell even mounts) instead of
  // creating a second pi session — no client-side placeholder id, ever; this
  // awaits the real, bridge-correlated sessionFile honestly.
  async initialize() {
    const sessionFile = await piBridge.ensureActiveSession();
    return { remoteId: sessionFile, externalId: sessionFile };
  },
  async rename(remoteId, newTitle) {
    piBridge.renameSession(remoteId, newTitle);
  },
  // ponytail: pi/bridge has no archive/delete/title-generation concept yet —
  // add real bridge commands when a UI actually needs them (we don't render
  // ThreadListPrimitive's archive/delete/title controls in this card).
  async archive() {
    throw new Error("Archiving sessions is not supported");
  },
  async unarchive() {
    throw new Error("Unarchiving sessions is not supported");
  },
  async delete() {
    throw new Error("Deleting sessions is not supported");
  },
  async generateTitle(): Promise<never> {
    throw new Error("Title generation is not supported");
  },
  async fetch(remoteId) {
    const session = piBridge.getSnapshot().sessions.find((s) => s.path === remoteId);
    if (!session) throw new Error(`Unknown session: ${remoteId}`);
    return toMetadata(session);
  },
};
