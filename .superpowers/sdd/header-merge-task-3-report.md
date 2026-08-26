# Task 3 Report — BKMH header settings API

**Status:** DONE

## Implemented
- Added Prisma model `ChungTuBkmhHeaderSettings` + SQL migration with `categoryKey` unique and `updatedById` FK.
- Added `chung-tu-bkmh-header-settings.service.js` with `get` / `upsert`, row mapping, and BKMH-only validation.
- Added `GET/PUT /api/chungtuquyettoan/bkmh-header-settings` with validator, controller, route definitions, and existing `LTTP_ISSUE_SLIPS_READ/WRITE` permissions.
- No permission catalog update was needed because the routes reuse existing permission codes.

## Tests
- `node --experimental-test-module-mocks --test /Users/midnight/quanluong-app/quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-bkmh-header-settings.service.test.js`
- `./quanluong-app-be/node_modules/.bin/prisma validate --schema /Users/midnight/quanluong-app/quanluong-app-be/prisma/schema.prisma`
- `./quanluong-app-be/node_modules/.bin/prisma generate --schema /Users/midnight/quanluong-app/quanluong-app-be/prisma/schema.prisma`
