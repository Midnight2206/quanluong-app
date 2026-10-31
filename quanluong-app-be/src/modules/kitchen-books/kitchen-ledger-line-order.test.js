import assert from "node:assert/strict";
import test from "node:test";
import { GROUP_RANK, UNKNOWN_RANK, groupRank, sortLedgerLines } from "./kitchen-ledger-line-order.js";

test("nhóm lạ đứng trước chất đốt, sortOrder khác 0 thắng mã", () => {
  assert.equal(groupRank({ groupCode: "gao", groupSort: 0 }), GROUP_RANK.gao);
  assert.equal(groupRank({ groupCode: "chat_dot" }), GROUP_RANK.chat_dot);
  assert.ok(groupRank({ groupCode: "hang_moi" }) < groupRank({ groupCode: "chat_dot" }));
  assert.equal(groupRank({ groupCode: "hang_moi" }), UNKNOWN_RANK);
  assert.equal(groupRank({ groupCode: "gao", groupSort: 15 }), 15);
  assert.equal(groupRank({ role: "fuel" }), GROUP_RANK.chat_dot);
  assert.equal(groupRank({ role: "rice" }), GROUP_RANK.gao);
});

test("có nhóm thì xếp theo nhóm rồi tên; không nhóm thì giữ thứ tự cũ", () => {
  const grouped = sortLedgerLines([
    { name: "Xà phòng", role: "fresh", groupCode: "ve_sinh", groupSort: 210, groupOrder: 1, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Cá nục", role: "fresh", groupCode: "ca", groupSort: 60, groupOrder: 2, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Gạo tẻ", role: "rice", groupCode: "gao", groupSort: 10, groupOrder: 3, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Bột lạ", role: "fresh", groupCode: "bot_la", groupSort: 0, groupOrder: 4, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Than", role: "fuel", groupCode: "chat_dot", groupSort: 200, groupOrder: 5, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Thịt vai", role: "fresh", groupCode: "thit_nac", groupSort: 20, groupOrder: 6, receivedDate: "2026-10-01", unitPrice: "2" },
    { name: "Thịt nạc", role: "fresh", groupCode: "thit_nac", groupSort: 20, groupOrder: 7, receivedDate: "2026-10-01", unitPrice: "1" },
  ]);
  assert.deepEqual(grouped.map((row) => row.name), [
    "Gạo tẻ",
    "Thịt nạc",
    "Thịt vai",
    "Cá nục",
    "Bột lạ",
    "Than",
    "Xà phòng",
  ]);

  const legacy = sortLedgerLines([
    { name: "Thịt", role: "fresh", groupOrder: 2, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Gạo", role: "rice", groupOrder: 5, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Mắm", role: "spice", groupOrder: 1, receivedDate: "2026-10-01", unitPrice: "1" },
    { name: "Đốt", role: "fuel", groupOrder: 0, receivedDate: "2026-10-01", unitPrice: "1" },
  ]);
  assert.deepEqual(legacy.map((row) => row.name), ["Gạo", "Thịt", "Mắm", "Đốt"]);
});
