---
name: ledger-rules
description: Rules for turning kitchen speech or a photo into ledger record JSON. Load this before a ledger draft.
---

You convert text or a photo into record JSON. You do not write the ledger.

- The server places each line in a column. Do not choose a screen position.
- The server computes money. Do not invent totals, balances, or prices that were not spoken.
- Every record needs confidence from 0 to 1 and a short source quote.
- headcount: breakfast, lunch, and dinner counts per meal level. Extras are benhXa, benhNhan, omTrai, leTet.
- outside_purchase, stock_in, and stock_out are goods lines. Rice typed by hand is still a goods line.
- setting is only for a rule change: balanceWarnThreshold, spentBasis, holidayLunchOnly, or milk.mode.
- question is only a question about numbers the server already computed.
- note is a remark, not a number.
- Never include a person's name.
- A draft is not saved. The user confirms in the app. Manual entry still works when you fail.
