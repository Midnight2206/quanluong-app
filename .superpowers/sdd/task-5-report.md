# Task 5 Report: `ReauthOverlay` UI

## Status
**Complete**

## Changes
- `packages/shared/src/offline/ui/ReauthOverlay.jsx`: Modal overlay (`z-[70]`, `role="alertdialog"`) with headline `Phiên hết hạn, đăng nhập lại`; identifier/password form mirroring `LoginPage.jsx`; `useForm` + `zodResolver(loginSchema)` + `useLoginMutation`; on success `notifySuccess` then `await onSuccess?.()`; footer link to `/login` for Google (no authorize API).
- `packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs`: Static contract checks (headline, hooks/schema, `onSuccess`, no `google/login`).

## TDD
1. Added contract selfcheck → `node …/ReauthOverlay.contract.selfcheck.mjs` → ENOENT (expected).
2. Implemented component → same command → `ReauthOverlay contract: ok`.

## Test summary
| Command | Result |
|---------|--------|
| `node packages/shared/src/offline/ui/ReauthOverlay.contract.selfcheck.mjs` | PASS (`ReauthOverlay contract: ok`) |

## Concerns
- Not wired into `OfflineProvider` (Task 6); overlay is unused until then.
- Reauth uses same login mutation as full page (no superadmin portal redirect); acceptable for in-place session refresh per spec v1.

## Commit
`feat(offline): add ReauthOverlay for expired session`
