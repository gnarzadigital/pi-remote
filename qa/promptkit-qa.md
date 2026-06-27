# prompt-kit integration QA — 2026-06-27

## Environment
- URL: `http://localhost:7700`
- Build: `pnpm run build:ui`
- Browser: Cursor IDE browser + headless Chrome 390×844

## Checklist

| Check | Result | Notes |
|-------|--------|-------|
| Sessions home loads | ✅ | Settings + New visible |
| Open session / chat | ✅ | Messages, thinking, tools render |
| ChatContainer stick-to-bottom | ✅ | `role="log"` present; scroll anchor wired |
| ScrollButton | ✅ | Visible when scrolled up; moved to `bottom-20` on mobile to avoid blocking tool rows |
| Thinking (Reasoning) | ✅ | Expand/collapse without layout crash |
| Tool cards (Tool) | ✅ | Collapsed by default; "Error" only on failed tools |
| Slash command picker | ✅ | `/skill` opens listbox above input (~11px gap) |
| PromptInput send/attach | ✅ | Textarea + paperclip + send button |
| Settings panel Light/Dark | ✅ | Dialog opens with theme options |
| Footer flush to viewport | ✅ | `footerBottom === innerHeight` on desktop QA |
| Console JS errors | ✅ | None observed |
| Mobile screenshot | ✅ | `qa-sessions-promptkit.png` |

## Known / accepted
- **bash Error labels**: real `error` status from pi tool results in this session, not UI chrome
- **Bundle size**: shiki adds ~690KB main chunk (syntax highlighting); acceptable for now
- **iOS keyboard gap**: not re-tested in this pass; visualViewport hook still in place

## Screenshots
- `qa/promptkit-slash-picker.png` — slash picker above input with session loaded
- `qa-sessions-promptkit.png` — mobile sessions home
