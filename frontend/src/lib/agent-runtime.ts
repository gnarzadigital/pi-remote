/**
 * Only "pi" agents support the rich RPC chat attach (3.8-full) — claude/codex/
 * other runtimes use an entirely different session protocol, so attaching a
 * pi --mode rpc process to them is not possible. Tapping one of those rows
 * should fall back to steer (the one action that works for any runtime via
 * `cmux send`), not silently attempt and fail an attach.
 */
export function canAttachChat(runtime?: string): boolean {
  return (runtime ?? "pi").toLowerCase() === "pi";
}
