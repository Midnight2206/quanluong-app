# System infra alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process API gửi một email lúc 02:00, 08:00, 14:00 và 20:00 khi đĩa hoặc container đang `warn` hoặc `down`.

**Architecture:** Hàm thuần lọc report của `readInfra` thành các dòng thư. Hàm gửi nhận danh sách người nhận và hàm gửi đã tiêm, nên test không đụng SMTP. `server.js` đăng ký cron gọi đúng hàm đó.

**Tech Stack:** Node `node:test`, `node-cron` qua `registerSchedule`, SMTP hoặc Gmail API cùng đường với thư backup, Prisma chỉ để lấy email superadmin.

## Global Constraints

- Làm trên nhánh đã có `readInfra` (`feat/system-infra-health`). Không viết lại bảng sức khỏe. Không bắt đầu từ `main` khi `readInfra` chưa có ở đó.
- Một email tại 02:00, 08:00, 14:00 và 20:00 `Asia/Ho_Chi_Minh`. Biểu thức `0 2,8,14,20 * * *`. Mốc 08:00 là một lần trong chu kỳ, không có thư gom thêm.
- Cron chỉ trong process API. Không đăng ký lịch này ở worker.
- Nguồn dữ liệu là `readInfra()`. Không đọc socket hay đĩa theo đường khác.
- Chỉ dòng đĩa và container có `status` `warn` hoặc `down`. Bỏ `ok` và `unknown`. Object `backup` không vào thư.
- Không còn dòng nào thì không gửi, và không tải người nhận.
- Một thư cho mọi dòng. Tiêu đề `[Quân lương] Hạ tầng cần xem`. Đĩa dùng nguyên `disk.message`. Container là `{name}: {message}`, đúng thứ tự mảng `containers`.
- Người nhận: user `superadmin` với `deletedAt: null`, `isActive: true`, cộng `config.auth.superadminEmail`, qua `backupReportRecipients`.
- App tắt đúng lúc mốc thì mốc đó mất. Không gửi bù. Không lưu mốc đã gửi.
- Không trang mới, không nút, không bảng database, không sửa compose, không sửa `backup.sh`, không tạo lại container `quanluong-backup`.
- Không thêm mã quyền. Không sửa `permission-catalog.vi.js`.

---

### Task 1: Lọc dòng cần gửi

**Files:**
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.alert.js`
- Test: `quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js`

**Interfaces:**
- Consumes: object trả về của `readInfra`: `{ disk: { status, message }, backup: { status, message }, containers: [{ name, status, message }] }`.
- Produces: `infraAlertLines(report) → string[]`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { infraAlertLines } from "./system-infra.alert.js";

test("bỏ qua khi chỉ có ok và backup warn", () => {
  assert.deepEqual(
    infraAlertLines({
      disk: { status: "ok", message: "Đã dùng 40%" },
      backup: { status: "warn", message: "Backup lỗi ngày 2026-10-07" },
      containers: [{ name: "quanluong-app-db", status: "ok", message: "đang chạy khỏe" }],
    }),
    [],
  );
});

test("đĩa unknown không thành dòng", () => {
  assert.deepEqual(
    infraAlertLines({
      disk: { status: "unknown", message: "Không đọc được đĩa" },
      backup: { status: "down", message: "Backup lỗi" },
      containers: [],
    }),
    [],
  );
});

test("đĩa warn giữ nguyên câu", () => {
  assert.deepEqual(
    infraAlertLines({
      disk: { status: "warn", message: "Đã dùng 34 GB (85%) — còn 6 GB" },
      backup: { status: "ok", message: "Backup xong ngày 2026-10-07" },
      containers: [],
    }),
    ["Đã dùng 34 GB (85%) — còn 6 GB"],
  );
});

test("container warn và down giữ thứ tự, bỏ unknown và ok", () => {
  assert.deepEqual(
    infraAlertLines({
      disk: { status: "ok", message: "Đã dùng 40%" },
      backup: { status: "ok", message: "Backup xong" },
      containers: [
        { name: "quanluong-app-db", status: "down", message: "đã dừng" },
        { name: "quanluong-app-redis", status: "unknown", message: "Không đọc được Docker" },
        { name: "quanluong-app-ui", status: "warn", message: "đang khởi động" },
        { name: "quanluong-backup", status: "ok", message: "đang chạy" },
      ],
    }),
    ["quanluong-app-db: đã dừng", "quanluong-app-ui: đang khởi động"],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: FAIL vì module chưa có.

- [ ] **Step 3: Write minimal implementation**

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.alert.js`:

```js
function infraAlertLines(report) {
  const lines = [];
  const disk = report?.disk;
  if (disk?.status === "warn" || disk?.status === "down") {
    lines.push(String(disk.message ?? ""));
  }
  for (const row of report?.containers ?? []) {
    if (row?.status === "warn" || row?.status === "down") {
      lines.push(`${row.name}: ${row.message ?? ""}`);
    }
  }
  return lines;
}

export { infraAlertLines };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.alert.js quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js
git commit -m "$(cat <<'EOF'
feat(infra): list disk and container rows that need an email

EOF
)"
```

---

### Task 2: Gửi một thư cho superadmin

**Files:**
- Create: `quanluong-app-be/src/infra/mail/send-infra-alert-email.js`
- Create: `quanluong-app-be/src/modules/system-infra/system-infra.alert-mail.js`
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js`

**Interfaces:**
- Consumes: `infraAlertLines(report) → string[]`. `backupReportRecipients(users, configuredEmail) → string[]`. `sendBackupReportEmail` là mẫu transport, không gọi hàm đó.
- Produces:
  - `buildInfraAlertMail(lines: string[]) → { subject: string, text: string, html: string }`.
  - `sendInfraAlertEmail({ to: string, lines: string[] }) → Promise<boolean>`.
  - `deliverInfraAlert(report, { recipients: string[], send }) → Promise<{ sent: number }>`.
  - `loadInfraAlertRecipients() → Promise<string[]>`.

- [ ] **Step 1: Write the failing test**

Thêm vào cuối `system-infra.alert.test.js`. Giữ import `infraAlertLines`. Thêm import `buildInfraAlertMail` và `deliverInfraAlert`.

```js
import { buildInfraAlertMail } from "../../infra/mail/send-infra-alert-email.js";
import { deliverInfraAlert } from "./system-infra.alert-mail.js";

const warnReport = {
  disk: { status: "warn", message: "Đã dùng 80%" },
  backup: { status: "ok", message: "Backup xong" },
  containers: [],
};

const okReport = {
  disk: { status: "ok", message: "Đã dùng 40%" },
  backup: { status: "warn", message: "Backup lỗi" },
  containers: [{ name: "quanluong-app-db", status: "ok", message: "đang chạy khỏe" }],
};

test("thư có tiêu đề cố định và escape html", () => {
  const mail = buildInfraAlertMail(["Đã dùng 80%", "quanluong-app-db: đã dừng"]);
  assert.equal(mail.subject, "[Quân lương] Hạ tầng cần xem");
  assert.equal(mail.text, "Đã dùng 80%\nquanluong-app-db: đã dừng\n");
  assert.match(mail.html, /<p>Đã dùng 80%<\/p><p>quanluong-app-db: đã dừng<\/p>/);
  assert.match(buildInfraAlertMail(["a < b"]).html, /a &lt; b/);
});

test("không có dòng thì không gọi send", async () => {
  let called = false;
  const result = await deliverInfraAlert(okReport, {
    recipients: ["a@example.com"],
    send: async () => {
      called = true;
      return true;
    },
  });
  assert.equal(called, false);
  assert.equal(result.sent, 0);
});

test("không có người nhận thì không gọi send", async () => {
  let called = false;
  const result = await deliverInfraAlert(warnReport, {
    recipients: [],
    send: async () => {
      called = true;
      return true;
    },
  });
  assert.equal(called, false);
  assert.equal(result.sent, 0);
});

test("một địa chỉ lỗi vẫn gửi địa chỉ sau", async () => {
  const calls = [];
  const result = await deliverInfraAlert(warnReport, {
    recipients: ["a@example.com", "b@example.com"],
    send: async ({ to, lines }) => {
      calls.push(to);
      assert.deepEqual(lines, ["Đã dùng 80%"]);
      if (to === "a@example.com") {
        throw new Error("smtp");
      }
      return true;
    },
  });
  assert.deepEqual(calls, ["a@example.com", "b@example.com"]);
  assert.equal(result.sent, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: FAIL vì `buildInfraAlertMail` và `deliverInfraAlert` chưa có. Bốn test của Task 1 vẫn pass.

- [ ] **Step 3: Write minimal implementation**

Tạo `quanluong-app-be/src/infra/mail/send-infra-alert-email.js`:

```js
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { createMailTransport } from "./mail.client.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";
import { sendMultipartEmailViaGmailApi } from "./gmail-transactional.send.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildInfraAlertMail(lines) {
  const subject = "[Quân lương] Hạ tầng cần xem";
  const text = `${lines.join("\n")}\n`;
  const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return { subject, text, html };
}

async function sendInfraAlertEmail({ to, lines }) {
  const { subject, text, html } = buildInfraAlertMail(lines);

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn("Gmail API chưa cấu hình — không gửi email hạ tầng");
      return false;
    }
    return sendMultipartEmailViaGmailApi({
      from: config.mail.gmailSenderEmail,
      to,
      subject,
      text,
      html,
    });
  }

  const transport = createMailTransport();
  if (!transport) {
    logger.warn("SMTP chưa cấu hình — không gửi email hạ tầng");
    return false;
  }
  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi email hạ tầng");
    return false;
  }
  await transport.sendMail({ from, to, subject, text, html });
  return true;
}

export { buildInfraAlertMail, sendInfraAlertEmail };
```

Tạo `quanluong-app-be/src/modules/system-infra/system-infra.alert-mail.js`:

```js
import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { logger } from "../../shared/utils/logger.js";
import { backupReportRecipients } from "../system-backup/system-backup.notify.js";
import { infraAlertLines } from "./system-infra.alert.js";

async function loadInfraAlertRecipients() {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      type: { name: "superadmin" },
    },
    select: { email: true },
  });
  return backupReportRecipients(users, config.auth.superadminEmail);
}

async function deliverInfraAlert(report, deps) {
  const lines = infraAlertLines(report);
  if (lines.length === 0) {
    return { sent: 0 };
  }
  const recipients = deps?.recipients ?? [];
  if (recipients.length === 0) {
    logger.warn("Không có email superadmin để báo hạ tầng");
    return { sent: 0 };
  }
  let sent = 0;
  for (const to of recipients) {
    try {
      if (await deps.send({ to, lines })) {
        sent += 1;
      }
    } catch (error) {
      logger.warn({ err: error }, "Gửi email hạ tầng thất bại");
    }
  }
  return { sent };
}

export { deliverInfraAlert, loadInfraAlertRecipients };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: 8 pass.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/infra/mail/send-infra-alert-email.js quanluong-app-be/src/modules/system-infra/system-infra.alert-mail.js quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js
git commit -m "$(cat <<'EOF'
feat(infra): send one alert email when disk or a container is unhealthy

EOF
)"
```

---

### Task 3: Cron bốn mốc trong process API

**Files:**
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.alert-mail.js`
- Modify: `quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js`
- Modify: `quanluong-app-be/src/server.js` (khối `registerSchedule` của `backup-report-mail`, khoảng dòng 84–88)

**Interfaces:**
- Consumes: `deliverInfraAlert`, `loadInfraAlertRecipients`, `sendInfraAlertEmail`, `readInfra` từ `system-infra.service.js`, `infraAlertLines`.
- Produces:
  - `INFRA_HEALTH_MAIL_SCHEDULE = "0 2,8,14,20 * * *"`.
  - `runInfraHealthMail(deps?) → Promise<{ sent: number }>`. `deps.readInfra`, `deps.loadRecipients`, `deps.send` đều tùy chọn. Mặc định: `readInfra`, `loadInfraAlertRecipients`, `sendInfraAlertEmail`.

- [ ] **Step 1: Write the failing test**

Thêm vào `system-infra.alert.test.js`:

Đổi dòng import `deliverInfraAlert` thành:

```js
import cron from "node-cron";
import { deliverInfraAlert, INFRA_HEALTH_MAIL_SCHEDULE, runInfraHealthMail } from "./system-infra.alert-mail.js";
```

`import cron` đặt cạnh các import đầu file. Rồi thêm:

```js
test("lịch là bốn mốc 02 08 14 20", () => {
  assert.equal(INFRA_HEALTH_MAIL_SCHEDULE, "0 2,8,14,20 * * *");
  assert.equal(cron.validate(INFRA_HEALTH_MAIL_SCHEDULE), true);
});

test("report toàn ok không tải người nhận", async () => {
  await runInfraHealthMail({
    readInfra: async () => okReport,
    loadRecipients: async () => {
      throw new Error("không được tải người nhận");
    },
    send: async () => {
      throw new Error("không được gửi");
    },
  });
});

test("report warn gửi đúng người nhận đã tải", async () => {
  const seen = [];
  const result = await runInfraHealthMail({
    readInfra: async () => warnReport,
    loadRecipients: async () => ["a@example.com"],
    send: async ({ to, lines }) => {
      seen.push({ to, lines });
      return true;
    },
  });
  assert.equal(result.sent, 1);
  assert.deepEqual(seen, [{ to: "a@example.com", lines: ["Đã dùng 80%"] }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: FAIL vì `INFRA_HEALTH_MAIL_SCHEDULE` và `runInfraHealthMail` chưa export. Tám test trước vẫn pass.

- [ ] **Step 3: Write minimal implementation**

Thay toàn bộ `system-infra.alert-mail.js` bằng:

```js
import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { sendInfraAlertEmail } from "../../infra/mail/send-infra-alert-email.js";
import { logger } from "../../shared/utils/logger.js";
import { backupReportRecipients } from "../system-backup/system-backup.notify.js";
import { infraAlertLines } from "./system-infra.alert.js";
import { readInfra } from "./system-infra.service.js";

const INFRA_HEALTH_MAIL_SCHEDULE = "0 2,8,14,20 * * *";

async function loadInfraAlertRecipients() {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      type: { name: "superadmin" },
    },
    select: { email: true },
  });
  return backupReportRecipients(users, config.auth.superadminEmail);
}

async function deliverInfraAlert(report, deps) {
  const lines = infraAlertLines(report);
  if (lines.length === 0) {
    return { sent: 0 };
  }
  const recipients = deps?.recipients ?? [];
  if (recipients.length === 0) {
    logger.warn("Không có email superadmin để báo hạ tầng");
    return { sent: 0 };
  }
  let sent = 0;
  for (const to of recipients) {
    try {
      if (await deps.send({ to, lines })) {
        sent += 1;
      }
    } catch (error) {
      logger.warn({ err: error }, "Gửi email hạ tầng thất bại");
    }
  }
  return { sent };
}

async function runInfraHealthMail(deps = {}) {
  const read = deps.readInfra ?? readInfra;
  const report = await read();
  if (infraAlertLines(report).length === 0) {
    return { sent: 0 };
  }
  const loadRecipients = deps.loadRecipients ?? loadInfraAlertRecipients;
  const recipients = await loadRecipients();
  const send = deps.send ?? sendInfraAlertEmail;
  return deliverInfraAlert(report, { recipients, send });
}

export { INFRA_HEALTH_MAIL_SCHEDULE, deliverInfraAlert, loadInfraAlertRecipients, runInfraHealthMail };
```

Trong `quanluong-app-be/src/server.js`, thêm import:

```js
import { INFRA_HEALTH_MAIL_SCHEDULE, runInfraHealthMail } from "./modules/system-infra/system-infra.alert-mail.js";
```

Ngay sau khối `registerSchedule` tên `backup-report-mail`, thêm:

```js
  registerSchedule(
    INFRA_HEALTH_MAIL_SCHEDULE,
    () => runInfraHealthMail(),
    { name: "infra-health-mail" },
  );
```

Không thêm lịch này vào entry của worker.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/modules/system-infra/system-infra.alert.test.js
```

Expected: 11 pass. Test lịch tính là một test, gồm cả `cron.validate`.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/system-infra/system-infra.alert-mail.js quanluong-app-be/src/modules/system-infra/system-infra.alert.test.js quanluong-app-be/src/server.js
git commit -m "$(cat <<'EOF'
feat(infra): mail disk and container alerts at 02, 08, 14, and 20

EOF
)"
```
