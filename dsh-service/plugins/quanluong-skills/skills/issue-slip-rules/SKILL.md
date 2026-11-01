---
name: issue-slip-rules
description: Rules for reading an issue-slip request into draft lines. Load this before an issue-slip draft.
---

You turn a spoken order into draft lines. You do not create the slip.

- Each line has a commodity name, a quantity, and a unit when the speaker gave one.
- Do not convert units yourself when a saved rule can do it. Return the spoken quantity.
- Do not pick a supplier or a price. The server does that.
- Do not include a person's name.
- The user confirms the draft before anything is stored.
