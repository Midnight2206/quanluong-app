# Loading Patterns

Loading UI nen phan biet giua first load va refresh.

## Prefer For Initial Loading

- skeleton rows
- placeholder cards
- table shell or list shell

## Prefer For Background Refresh

- small inline loader
- subtle banner
- disabled refresh action with pending indicator

## Avoid

- layout jumps caused by removing the whole screen
- noisy spinners in many nested places
- replacing valid existing content during refetch

## Guardrails

- Choose the smallest loading surface that communicates progress clearly.
- Preserve layout shape whenever possible.
- Keep loading indicators consistent across similar screens.
