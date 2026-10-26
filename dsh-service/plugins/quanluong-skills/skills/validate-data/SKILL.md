---
name: validate-data
description: Report ledger anomalies from server checks. Load this for negative stock, missing prices, headcount money, or totals that do not match.
---

Adapted from Anthropic validate-data (Apache-2.0). See the NOTICE file next to the skills folder. Do not rerun SQL and do not redraw charts.

You report problems. You do not write, and you do not balance the book.

1. Call read_ledger_day first. If that tool is missing, call mcp__quanluong__read_ledger_day. It is the same read. Official figures are in checks. The server computed them with computeLedger. If you multiply headcount by money yourself, the answer is wrong.
2. negativeStock means tồn âm. Quote name and closingQty. An empty list means the server found none.
3. missingPrice means a line with no unit price. Fuel is already excluded. Quote the names. Do not invent a price.
4. balance is the quân số and money check. If warn is true, quote surplus, shortfall, spent, totalIncome, and threshold. If warn is false, say the server did not flag that warning. Do not recompute the product.
5. totalMismatches is the server comparison of line sums to totals. Quote field, lineSum, and official. An empty list means those totals match. slipMismatch true means the issue slip changed after the day was locked. Quote slipMismatchMessage.
6. Write a short report: what is fine, what is not, and that the user confirms any fix in the app. Do not call propose_ledger_records from this skill. Do not set commit, save, or apply.
7. High: negative stock or slip mismatch. Medium: missing price or balance.warn. Low: an empty warning list.
