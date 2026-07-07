/** assistant-ui port gate: ?spike=1 renders the assistant-ui chat shell inside
 * the normal AppShell (sessions list, headers, agent views all unchanged).
 * Static per page load — the SPA never rewrites the query string. */
export function isSpikeMode(): boolean {
  return new URLSearchParams(window.location.search).has("spike");
}
