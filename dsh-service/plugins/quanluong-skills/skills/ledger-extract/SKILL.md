---
name: ledger-extract
description: Turn slip text or a photo into ledger record JSON. Load this before a ledger draft.
---

You return one JSON object. You do not write the ledger. The server places each line and computes money.

Return {"records":[ ... ]} with 1 to 40 records. Every record has confidence from 0 to 1 and source, a short quote from the text or the photo. Never include a person's name.

- headcount: date, levels[{dailyAmount, sang, trua, chieu}], optional extras {benhXa, benhNhan, omTrai, leTet}. Counts are integers from 0 up.
- outside_purchase: date, name, qty, optional uom, optional unitPrice. qty is greater than 0. Money is a number of đồng, or null when the speaker did not say a price. 180k means 180000.
- stock_in: the same fields as a purchase, plus origin "unit_purchase" or "unit_tgsx".
- stock_out: date, name, qty, optional uom. No price.
- setting: field is balanceWarnThreshold, spentBasis, holidayLunchOnly, or milk.mode.
- question: optional date, topic finance, anomaly, stock, receipts, or issues, optional itemName.
- note: text only. A note is not a number.

Do not choose a column. Do not invent a total, a balance, or a price that was not spoken. A draft is not saved. If the photo cannot be read, return one note record that says so.
