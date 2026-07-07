/** Resolve the workspace pi boots into after a bridge restart: the last-used
 * workspace if it still exists on disk, else the launchd/env default. Keeps
 * the phone session where it was left instead of resetting to AGENT_CWD. */
export function resolveBootCwd(
  lastCwd: string | undefined,
  fallback: string,
  isDir: (p: string) => boolean,
): string {
  if (lastCwd && isDir(lastCwd)) return lastCwd;
  return fallback;
}
