# Final Fix Report

## Scope

- Fixed Chung Tu PDF preview popup handling to use a pre-opened blank tab and then navigate it to the blob URL.
- Removed the same latent `window.open(..., "noopener,noreferrer")` null-window defect from merged batch PDF opening.
- Recovered publish/retire template state when document service returns `409 CONFLICT` but Prisma still needs to move to the target status.
- Changed the Superadmin publish confirmation to use the default confirm variant.

## Verification

- Command: `node --experimental-test-module-mocks --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`
- Result: `11/11` tests passing
