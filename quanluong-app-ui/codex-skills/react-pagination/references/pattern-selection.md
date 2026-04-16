# Pattern Selection

Tai lieu nay giup chon dung loai pagination cho task.

## Choose Cursor Pagination When

- the dataset is large
- records change frequently
- you want stable forward loading
- the UI feels more like feed, stream, or load-more navigation

## Choose Offset Or Page Pagination When

- the UI is a classic admin table
- users need to jump between page numbers
- the backend already exposes `page`, `limit`, `offset`, or `total`
- explicit page count matters to the experience

## Guardrails

- Do not force page numbers on top of a cursor-only API.
- Do not simulate cursor pagination if the backend clearly speaks in page and total metadata.
- Pick one mental model for each screen and stay consistent.
