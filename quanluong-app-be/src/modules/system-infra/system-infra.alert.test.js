import assert from "node:assert/strict";
import test from "node:test";
import { buildInfraAlertMail } from "../../infra/mail/send-infra-alert-email.js";
import { deliverInfraAlert } from "./system-infra.alert-mail.js";
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
