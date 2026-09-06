# Task 1 Report — seed template field labels on create

**Status:** completed

## Commit

- Planned message: `feat(chung-tu): seed PDF template field labels from prior version`

## Files modified

| File | Change |
|------|--------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js` | Seeded `fieldLabelsJson` from the latest prior template with the same `categoryKey` and `name` before create |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js` | Added TDD coverage for prior-label seeding and empty fallback, and updated the existing create assertion |

## TDD notes

1. Added a failing test proving create should copy `fieldLabelsJson` from the latest prior same-name template.
2. Added a failing test proving create should persist `{}` when no prior same-name template exists.
3. Implemented a single `findFirst` lookup ordered by `updatedAt desc`, normalized the labels, and passed them into create.
4. Re-ran the targeted backend test file until all assertions passed.

## Verification

- `node --experimental-test-module-mocks --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`
- `ReadLints` on the touched backend service and test files returned no errors.

## Concerns

1. The seed lookup matches only `categoryKey` + `name`, exactly per plan; it intentionally ignores `displayName` and status.
2. This task does not implement the FE label modal from Task 2.
