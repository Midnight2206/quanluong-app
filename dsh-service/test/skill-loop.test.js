import assert from "node:assert/strict";
import test from "node:test";
import { emptyBook } from "../src/json-doc.js";
import {
  acceptSkill,
  draftSkill,
  listUnitSkills,
  noteSkillUse,
  rejectSkill,
  skillFromTrace,
} from "../plugins/quanluong-skill-loop/logic.js";

test("a finished task becomes a draft skill and stays inside the unit", () => {
  const traced = skillFromTrace({
    task: "Đối soát sổ",
    toolTrace: ["read_ledger_day", "load_quanluong_skill"],
  });
  assert.equal(traced.name, "doi-soat-so");
  assert.match(traced.body, /Không tự cộng/);
  assert.match(traced.body, /1\. Gọi `read_ledger_day`/);
  const drafted = draftSkill(emptyBook(), {
    ...traced,
    unitId: "unit-a",
    accountId: "user-1",
    id: "skl-1",
    now: "2026-11-01T00:00:00.000Z",
  });
  assert.equal(drafted.skill.status, "draft");
  assert.equal(listUnitSkills(drafted.doc, "unit-b").length, 0);
  assert.throws(() => skillFromTrace({ task: "one", toolTrace: ["read_ledger_day"] }), /at least two/);
});

test("using a skill files an improvement draft and does not replace the active text", () => {
  const drafted = draftSkill(emptyBook(), {
    unitId: "unit-a",
    accountId: "user-1",
    name: "doi-soat",
    description: "doi soat",
    body: "Buoc 1",
    id: "skl-1",
    now: "2026-11-01T00:00:00.000Z",
  });
  const accepted = acceptSkill(drafted.doc, { unitId: "unit-a", id: "skl-1", now: "2026-11-01T01:00:00.000Z" });
  assert.equal(accepted.skill.status, "active");
  const noted = noteSkillUse(accepted.doc, {
    unitId: "unit-a",
    accountId: "user-1",
    name: "doi-soat",
    outcome: "fail",
    improvement: "Doc lai ngay hom truoc",
    now: "2026-11-01T02:00:00.000Z",
  });
  const active = noted.doc.units["unit-a"].skills.find((item) => item.id === "skl-1");
  assert.equal(active.body, "Buoc 1");
  assert.equal(active.status, "active");
  assert.equal(active.uses, 1);
  assert.equal(noted.revision.status, "draft");
  assert.match(noted.revision.body, /Khi dùng lại/);
  const again = acceptSkill(noted.doc, { unitId: "unit-a", id: noted.revision.id });
  assert.equal(again.skill.status, "active");
  assert.equal(again.doc.units["unit-a"].skills.find((item) => item.id === "skl-1").status, "archived");
  assert.throws(() => acceptSkill(again.doc, { unitId: "unit-b", id: noted.revision.id }), /not found/i);
});

test("a blocked skill body is refused and a draft can be rejected", () => {
  assert.throws(() => draftSkill(emptyBook(), {
    unitId: "unit-a",
    accountId: "user-1",
    name: "bad-skill",
    description: "no",
    body: "rm -rf /",
  }), /blocked/i);
  const drafted = draftSkill(emptyBook(), {
    unitId: "unit-a",
    accountId: "user-1",
    name: "tam",
    description: "tam",
    body: "Chi bao cao",
    id: "skl-2",
  });
  const rejected = rejectSkill(drafted.doc, { unitId: "unit-a", id: "skl-2" });
  assert.equal(rejected.skill.status, "rejected");
});
