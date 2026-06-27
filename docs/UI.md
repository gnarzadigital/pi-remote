# pi-remote UI (canonical)

The mobile web UI is the **React app in `frontend/`**. The bridge serves the built output from `public/`.

## Source of truth

| Path | Role |
|------|------|
| `frontend/src/` | All UI code (React, shadcn-style components, bridge client) |
| `frontend/src/index.css` | Design tokens (graphite/chalk, hairline borders, light + dark) |
| `public/` | **Build output** — what `bridge.ts` serves on `:7700` |
| `public-legacy/` | Archived vanilla UI (reference only, not served) |
| `mockups/` | Design exploration screenshots |

**Never edit `public/assets/*` by hand.** Change `frontend/`, then rebuild.

## Design system (locked)

Monochromatic Swiss grid — Codex-minimal, mobile-first.

- **Light:** canvas `#ffffff`, graphite text `#0a0a0a`, hairline `#e5e5e5`, mist `#f2f2f2`
- **Dark:** canvas `#0a0a0a`, card `#171717`, hairline `#2e2e2e`
- **Typography:** Inter (UI), Geist Mono (code)
- **Radii:** 10px controls, 14px cards
- **Primary actions:** solid black (light) / chalk on graphite (dark)

Theme persists in `localStorage` key `pi-remote-theme`.

## Stack

UI components from [prompt-kit](https://www.prompt-kit.com/docs/chat-container):

- **ChatContainer** + **ScrollButton** — stick-to-bottom auto-scroll (`use-stick-to-bottom`)
- **Message** — user/assistant bubbles with markdown via shiki
- **Reasoning** — collapsible thinking blocks
- **Tool** — collapsible tool call cards
- **PromptInput** — autosizing input with action slots
- **ChainOfThought** — thinking steps with vertical rail (`ThinkingChain`)
- **ThinkingBar** + **TextShimmer** — streaming indicator with stop
- **Steps** — grouped consecutive tool runs
- **SystemMessage** — system + error notices
- **Loader** — streaming status variants
- **Source** — citation hover cards (installed, wire when pi exposes sources)

Install more: `npx shadcn add "https://prompt-kit.com/c/<component>.json"`

MCP (Cursor): `.cursor/mcp.json` points at the prompt-kit registry for browsing/adding components in chat.

## Commands

```bash
# Dev with HMR (port 5173, proxy to bridge if configured)
pnpm run dev:ui

# Production build → public/
pnpm run build:ui

# Bridge auto-builds UI if public/ is missing (prestart)
pnpm start
```

## After UI changes

1. Edit files under `frontend/src/`
2. Run `pnpm run build:ui`
3. Commit **both** `frontend/` and `public/` (so Tailscale / Mac Mini work without Node build step)
4. Hard refresh on phone, or reinstall PWA if cached (service worker uses network-first for `/assets/`)

## iOS / PWA notes

- `useVisualViewport` hook keeps layout aligned when the keyboard opens
- Slash command picker floats above the input (`absolute bottom-full`), not inline in footer flow
- Textarea is 16px on mobile to prevent Safari zoom
- Safe-area padding drops when keyboard is open (`html.keyboard-open`)

## Do not regress

- Do not restore `public/client.js` or `public/style.css` (legacy vanilla UI)
- Do not change `bridge.ts` or WebSocket RPC protocol for UI work
- Bridge client lives in `frontend/src/lib/pi-bridge-client.ts` — port logic there, not in bridge
