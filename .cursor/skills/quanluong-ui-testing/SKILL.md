---
name: quanluong-ui-testing
description: Start and browser-test the Quân lương app locally. Use with the webapp-testing skill or the Playwright MCP when checking login, /so-sach-bep-an, or /lttp-nhap-xuat, including the day ledger table, sticky header, and Trợ lý làm sổ.
---

# Quân lương UI testing

Repo-specific companion to `webapp-testing`. The app is a logged-in Next.js UI, not static HTML. Drive the already-running dev stack. Do not start a second server on the same ports.

## Start the dev stack

From the repo root, on the owner's Mac or any machine with Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up --build
```

`quanluong-app-be/.env.docker` is local only (copy from `quanluong-app-be/.env.docker.example`). Never commit it and never paste production passwords into the repo, a skill, or a test script.

| Surface | Host URL in dev compose |
|---|---|
| Web app | http://localhost:8080 |
| Superadmin | http://localhost:8081 |
| Supplier | http://localhost:8082 |
| API | http://localhost:3000 |
| Socket.io | http://localhost:3030 |
| MariaDB | localhost:3307 |
| Document service | http://localhost:8000 |

The web container publishes `8080:3000`. The browser on the host uses port **8080**. `NEXT_PUBLIC_API_BASE_URL` is `http://localhost:3000/api`.

Backend health (no auth):

```bash
curl -fsS http://localhost:3000/api/health
```

Expect `success: true` and `data.status` of `ok`. The compose healthcheck calls the same path inside the `app` container.

`npm run dev:web` binds Next to port 3000 and collides with the API. Use the compose dev stack for browser tests.

## Local login

There is no committed test password. The login form is `/login`: **identifier** (email or username, at least 3 characters) and **password** (at least 8).

Create the local superadmin by booting the API once with `RUN_SUPERADMIN_BOOTSTRAP=true` in the local env file. The account is `SUPERADMIN_EMAIL` / `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` from that file. After the user exists, set `RUN_SUPERADMIN_BOOTSTRAP=false`. Production rejects weak bootstrap passwords; do not reuse a local password anywhere else.

Sample kitchen data does not create a user. After the API has bootstrapped a unit and the superadmin exists:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker \
  exec app node scripts/seed-dev-lttp-chung-tu.js
```

`npm run seed:meal-allowance` and `npm run seed:dev-lttp` in `quanluong-app-be` are the same scripts. `DEV_SEED_FORCE=1` rebuilds the current month of dev phiếu xuất. The seed note and unit names (`Đơn vị mẫu cấp 2`, `LTTP kho mẫu 01`–`06`) mark dev rows.

## How to drive the browser

Follow `webapp-testing`: the server is already running, so do reconnaissance then action (open the page, wait for `networkidle`, read the DOM, then click). The project Playwright MCP in `.cursor/mcp.json` is an alternative to a Python Playwright script. Do not add a database MCP.

Log in through the UI. Do not call production hosts.

## Smoke pages

1. `/login` — identifier and password, then a post-login shell (sidebar).
2. `/so-sach-bep-an?tab=so-nhap-xuat-lttp` — day page **Sổ nhập xuất LTTP**.
   - Ledger table (`aria-label` "Sổ nhập xuất LTTP") uses a sticky header (`stickyLevel` 2). Scroll the page and confirm the header stays put.
   - First columns are **TT** and **Tên LTTP**, then ĐVT and Đơn giá.
   - On a wide viewport the right-hand panel is the aside **Công khai tài chính** (quân số by mức, ăn thêm, thừa/thiếu).
   - **Trợ lý làm sổ** is the card above that grid (`KitchenLedgerAssistant`): heading, textarea "Nội dung gửi trợ lý", and Gửi. In this tree it is an inline card, not a floating button. The bottom-right control is the messenger dock (Tin nhắn), a different feature. If a build shows a bottom-right **Trợ lý** bubble, open it, confirm the same composer in a modal, and close it without leaving a scroll trap.
3. `/lttp-nhap-xuat` — tabs **Phiếu xuất**, **Lịch sử xuất kho**, **Cài đặt chữ ký**, and **Đặt hàng** (`/lttp-nhap-xuat/ordering-lttp`). Open Phiếu xuất and confirm the page renders for the logged-in unit.

Empty ledger copy ("Chưa có dòng hàng") is a valid smoke result when the day has no phiếu xuất or bảng giá. A login or health failure is not.
