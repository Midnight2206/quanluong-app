# Final whole-branch review fixes — 2026-07-25

## Scope

Fixed all requested Critical and Important findings except Critical #1, which remains a product decision: the day-menu editor was not restored.

## Fixes

- C2: sample dish normalization now raises `AppError` (400, `VALIDATION_ERROR`); sample-only schema requires each dish to contain at least one LTTP line; the UI cannot delete a dish's final LTTP line.
- C3: apply requests now include `unitId` in the POST body, and the backend apply schema requires it.
- I4: the sample UI explains that the unit must choose a meal allowance rate in Sổ chấm cơm; a 403 additionally points to `mealRoster.access`.
- I5: creation and updates validate the selected meal rate against `dataScope.logicalUnitId`; catalog line validation still uses storage scope.
- I6: client save is blocked unless there is a named dish and every line has a commodity plus valid quantity fields.
- I7: the persisted `rateId` survives the initial `null` → selected-unit resolution.
- I8: sample apply helpers moved to `kitchen-books-menu-sample-apply.js`, so their test no longer imports Prisma or requires `DATABASE_URL`.
- I9: applying a sample preserves the selected period's existing note.
- Docs: the detail-menu spec now states Sổ thực đơn is read-only and daily writes currently occur only through Áp dụng mẫu.
- Cheap fixes: apply date uses local time; overwrite confirmation uses `useConfirm`.

## Tests

```sh
node --test quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.test.js
# PASS: 7 tests; no DATABASE_URL required

node --test packages/shared/src/pages/kitchen-books/KitchenMenuTab.review.test.js packages/shared/src/features/kitchen-books/kitchenBooksApi.review.test.js
# PASS: 6 tests

npm run build:web
# PASS: Next.js production build
```

`ReadLints` found no diagnostics in the edited production files; `git diff --check` passed.

## Remaining concern

Critical #1 remains intentionally unresolved: restoring direct day-menu editing requires a product decision.

## 2026-08-23 chung-tu PDF export final fixes
Status: done; exposed default/template `signature_block` in template fields and now reject unsupported PDF export `categoryKey` at Zod boundary.
Commits: `fix(chung-tu): expose signature_block in fields + validate PDF export category`
Tests:
- `node --test "./quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.validator.test.js"` -> PASS (`4` tests)
- `python3 -m venv ".tmp/document-service-test-venv" && ".tmp/document-service-test-venv/bin/pip" install -r "services/document-service/requirements.txt" && ".tmp/document-service-test-venv/bin/python" -m pytest "services/document-service/tests/test_templates_http.py"` -> PASS (`24 passed`)
