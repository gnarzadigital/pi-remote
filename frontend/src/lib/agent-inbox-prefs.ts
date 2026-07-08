const COLLAPSE_KEY = "pi-remote-collapse-agents-by-workspace";
export const AGENT_INBOX_PREFS_CHANGED_EVENT = "agent-inbox-prefs-changed";

/** Default ON: one row per cmux workspace in the inbox, not one row per live
 *  terminal session. A workspace with several panes (common — spawning a task
 *  inside an already-open project workspace) was flooding "Needs you"/"Working"
 *  with siblings that all say the same workspace. */
export function getCollapseAgentsByWorkspace(): boolean {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function setCollapseAgentsByWorkspace(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(AGENT_INBOX_PREFS_CHANGED_EVENT));
}
