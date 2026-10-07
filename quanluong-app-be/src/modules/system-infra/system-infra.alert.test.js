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
