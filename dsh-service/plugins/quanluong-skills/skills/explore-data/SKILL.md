---
name: explore-data
description: Describe one kitchen-ledger day from the server read. Load this before answering what is on the ledger.
---

Adapted from Anthropic explore-data (Apache-2.0). See the NOTICE file next to the skills folder. Warehouse SQL and file profiling are not used here.

You describe one ledger day. You do not write.

1. Call read_ledger_day with the grant id and the date. If that tool is missing, call mcp__quanluong__read_ledger_day. It is the same read. If the call fails, say so. Do not invent rows.
2. The grain is one day for one unit. A line is one stock lot. A movement is a goods line. Headcount is meal counts.
3. Report only fields in the tool JSON: the date, how many lines, whether headcount was saved, and the checks object.
4. Quality issues are checks only: negative stock, missing price, the balance warning, slip mismatch, and total mismatches. Quote those values. Do not compute a mean, a percentile, or a new total.
5. Do not ask for a CSV, a warehouse, or a chart. Answer in a short text report.
6. Do not include a person's name.
