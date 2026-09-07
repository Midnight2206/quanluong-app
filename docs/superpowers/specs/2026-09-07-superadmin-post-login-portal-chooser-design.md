# Design Spec: Trang chọn cổng sau đăng nhập (superadmin)

**Date:** 2026-09-07  
**Status:** Draft for review  
**Feature:** Một trang login (app chính); sau login, superadmin chọn «Làm việc» hoặc «Quản trị»; không đổi Google callback BE  

---

## 1. Problem

- App chính (`apps/web`) và cổng superadmin (`apps/superadmin`) đều có `/login` (cùng `LoginPage`).
- Sau đăng nhập, mọi user (kể cả superadmin) bị `router.replace(from || "/")` trên **cùng origin** → superadmin hay bị đẩy vào trang làm việc chính thay vì cổng quản trị.
- Hai origin (`:3000`/`:3001` hoặc `:8080`/`:8081`) khiến “luôn redirect sang SA từ BE Google” cần thêm env/`PUBLIC_SUPERADMIN_URL` và sửa callback — muốn **tránh** trong scope này.

---

## 2. Locked Decisions

| # | Quyết định |
|---|------------|
| 1 | **Một login duy nhất** trên app chính |
| 2 | Superadmin sau login → **trang chọn** (không auto vào SA, không auto ở lại trang chính) |
| 3 | Hai lựa chọn: **Làm việc** (app chính `/`) · **Quản trị** (`getSuperadminAppOrigin()/dashboard`) |
| 4 | User không phải superadmin: hành vi redirect sau login **như hiện tại** (`safeInternalPath(from)`) |
| 5 | **Không** sửa Google login callback BE; tận dụng `from` FE đã gửi |
| 6 | Google: khi bắt đầu OAuth từ `LoginPage`, luôn gửi `from=/chon-cong` (path trang chọn) |
| 7 | Trang chọn: nếu user không phải superadmin (vd. Google `from` chung) → redirect ngay về `/` |
| 8 | Cổng SA: `/login` redirect sang login app chính; chưa auth trên route private → login app chính |
| 9 | Ngoài scope: gộp cùng domain; `COOKIE_DOMAIN` / SSO subdomain; nhớ lựa chọn lần sau; đổi `PUBLIC_WEB_URL` callback; auto vào SA |

---

## 3. Routes & UX

### 3.1 Trang chọn

- Path (app chính): `/chon-cong`
- Chỉ hiển thị khi đã auth **và** `user.type.name === "superadmin"`
- Nội dung tối giản: tiêu đề ngắn + 2 CTA
  - **Làm việc** → `router.replace("/")` (cùng app)
  - **Quản trị** → `window.location.assign(`${getSuperadminAppOrigin()}/dashboard`)` (full navigation sang origin SA)
- Chưa auth → redirect `/login` (có thể kèm `from=/chon-cong`)
- Auth nhưng không phải superadmin → redirect `/`

### 3.2 Login (app chính)

- Mật khẩu thành công:
  - superadmin → `/chon-cong` (**bỏ qua** `?from=` khi là superadmin)
  - khác → `safeInternalPath(searchParams.from)` như cũ
- Google: `authorize-url?from=/chon-cong` (encode); lỗi Google vẫn về `/login` theo BE hiện tại

### 3.3 Cổng superadmin

- `apps/superadmin/.../login`: không render form; redirect client (hoặc tương đương) tới `${getMainAppOrigin()}/login`
- `SuperadminOnlyRoute` khi chưa đăng nhập: `href` = `${getMainAppOrigin()}/login` (không còn `/login?from=...` nội bộ SA)

---

## 4. Helpers

Mở rộng `packages/shared/src/utils/postLoginPath.js` (hoặc module cạnh đó):

```js
export const SUPERADMIN_PORTAL_CHOOSER_PATH = "/chon-cong";

export function isSuperadminUser(user) {
  return user?.type?.name === "superadmin";
}

/** Sau login mật khẩu / quyết định đích nội bộ. */
export function resolvePostLoginPath(user, fromRaw) {
  if (isSuperadminUser(user)) return SUPERADMIN_PORTAL_CHOOSER_PATH;
  return safeInternalPath(fromRaw);
}
```

`LoginPage` dùng `resolvePostLoginPath` + user từ kết quả `login().unwrap()` (đã có trong auth store / response).

---

## 5. Auth / cookie note

- Cookie `ql.at` / `ql.rt` gắn **API** (`credentials: include`), không gắn origin UI.
- Login trên app chính rồi `location.assign` sang cổng SA vẫn dùng cùng phiên API (CORS origins đã whitelist cả hai UI).
- Dev hai port không cần `COOKIE_DOMAIN` cho flow này.

---

## 6. Testing

1. User thường: login mật khẩu → `/` (hoặc `from` nội bộ hợp lệ).
2. Superadmin: login mật khẩu → `/chon-cong` dù URL có `?from=/anything`.
3. Trên `/chon-cong`: «Làm việc» → `/`; «Quản trị» → origin SA `/dashboard`.
4. Non-superadmin mở `/chon-cong` → `/`.
5. Google login (FE gửi `from=/chon-cong`): superadmin thấy trang chọn; user thường bị đá về `/`.
6. Mở `SA/login` → redirect login app chính.
7. Mở SA private khi chưa auth → login app chính.
8. Source/unit tests cho `resolvePostLoginPath` / `isSuperadminUser`.

---

## 7. Out of scope / risks

- Gộp một domain / path `/admin` — làm sau nếu product muốn bỏ hai origin.
- Google error redirect vẫn về `PUBLIC_WEB_URL/login` (BE) — chấp nhận.
- Superadmin chọn «Làm việc» rồi muốn sang SA: dùng sidebar «Quản trị hệ thống» hiện có (không đổi trong spec này).
- Nếu sau này bắt buộc deep-link SA trước login: có thể thêm query trên login chính; **không** nằm trong ship này.
