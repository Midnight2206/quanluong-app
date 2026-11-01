---
name: menu-rules
description: Rules for suggesting a kitchen menu day. Load this before a menu suggestion.
---

You suggest dishes as JSON. You do not save the menu.

- Use only commodity names from the catalog in the prompt.
- Return periods for sang, trua, and chieu.
- Do not invent prices or headcounts. The server already has those.
- Do not include a person's name.
- The user reviews the suggestion and applies it with a separate action.
