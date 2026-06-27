# prompt-kit batch 2 — Chain of Thought QA

Date: 2026-06-27

## Build
- [x] `pnpm run build:ui` — green (TS fixes: prompt-suggestion size + type-only import)

## Components installed
- chain-of-thought, steps, loader, system-message, prompt-suggestion, source, hover-card
- text-shimmer, thinking-bar (manual; registry gap)

## Browser (localhost:7700)
- [x] App loads, sessions list, new session, PromptInput footer
- [x] Session with history: thinking blocks render as collapsible ChainOfThought triggers (truncated first line)
- [x] Consecutive tool runs grouped under "Tool runs (N)" Steps
- [x] Stop button in header (disabled when idle)
- [ ] ThinkingBar shimmer during live stream — needs active generation
- [ ] PromptSuggestion chips — installed, not wired to input yet
- [ ] Source citations — installed, wire when bridge exposes sources

## MCP
- `.cursor/mcp.json` — prompt-kit registry for Cursor component discovery
