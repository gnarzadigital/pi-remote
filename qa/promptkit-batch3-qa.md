# prompt-kit batch 3 — Suggestions, lazy shiki, Source QA

Date: 2026-06-27

## Build
- [x] `pnpm run build:ui` — green
- [x] Main bundle ~565 KB (was ~706 KB); shiki split to lazy `shiki-*.js` (~9.5 MB, loaded on demand)
- [x] `code-block-*.js` separate chunk (~1.9 KB loader)

## PromptSuggestion chips
- [x] Chips render above input from live pi `commands` (no hardcoded prompts)
- [x] Click fills input (verified: `/skill:sys:context-finder `)
- [x] Hidden while streaming or slash cmd picker open
- [x] Short `/command` labels + `title` tooltip for description (fixes overlap bug)

## Chain of Thought + streaming
- [x] Thinking enabled (Low): Step 1… expand/collapse with brain icon rail
- [x] Header Stop enabled while Running
- [x] Status line shows Running → Ready

## Source (markdown links)
- [x] External URLs in assistant/thinking markdown render as Source chips (example.com favicon pill)
- [x] Hover card wired via HoverCard

## Shiki lazy load
- [x] Dynamic `import("shiki")` via `lib/shiki-highlighter.ts`
- [x] Markdown code fences lazy-load `code-block` chunk
- [x] End-to-end code fence highlight — `console.log('hi')` block rendered with shiki theme attr

## Browser notes
- Use `browser_type` not `browser_fill` for controlled PromptInput (React state)
- Push to origin still blocked (403)
