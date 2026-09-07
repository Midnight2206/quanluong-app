import assert from "node:assert/strict";
import test from "node:test";

import { mapCurrentUser } from "./auth.mapper.js";
import { meProfilePatchSchema } from "./auth.validator.js";

test("meProfilePatchSchema accepts donViCapTren and donVi", () => {
  assert.deepEqual(
    meProfilePatchSchema.parse({
      donViCapTren: "Sư đoàn 372",
      donVi: "Tiểu đoàn 1",
    }),
    {
      donViCapTren: "Sư đoàn 372",
      donVi: "Tiểu đoàn 1",
    },
  );
});

test("mapCurrentUser returns donViCapTren and donVi on profile", () => {
  const mapped = mapCurrentUser({
    id: 1,
    username: "demo",
    email: "demo@example.com",
    isActive: true,
    emailVerifiedAt: new Date("2026-08-26T00:00:00.000Z"),
    googleDriveFolderId: null,
    registrationStatus: "APPROVED",
    jobTitle: null,
    type: null,
    unit: null,
    assignedUnit: null,
    permissions: [],
    profile: {
      id: 10,
      fullName: "Demo User",
      birthday: null,
      avatarUrl: null,
      description: null,
      jobTitle: null,
      rankFull: null,
      rankAbbr: null,
      department: null,
      phoneNumber: null,
      address: null,
      donViCapTren: "Sư đoàn 372",
      donVi: "Tiểu đoàn 1",
    },
  });

  assert.equal(mapped.profile.donViCapTren, "Sư đoàn 372");
  assert.equal(mapped.profile.donVi, "Tiểu đoàn 1");
});

test("meProfilePatchSchema accepts rankFull, rankAbbr, department", () => {
  assert.deepEqual(
    meProfilePatchSchema.parse({
      rankFull: "Trung tá",
      rankAbbr: "Tr.tá",
      department: "Phòng Tham mưu",
    }),
    {
      rankFull: "Trung tá",
      rankAbbr: "Tr.tá",
      department: "Phòng Tham mưu",
    },
  );
});

test("meProfilePatchSchema rejects rankAbbr over 32 chars", () => {
  assert.throws(
    () => meProfilePatchSchema.parse({ rankAbbr: "x".repeat(33) }),
  );
});

test("mapCurrentUser maps rankFull, rankAbbr, department on profile", () => {
  const mapped = mapCurrentUser({
    id: 2,
    username: "u2",
    email: "u2@example.com",
    isActive: true,
    emailVerifiedAt: null,
    googleDriveFolderId: null,
    registrationStatus: "APPROVED",
    jobTitle: null,
    type: null,
    unit: null,
    assignedUnit: null,
    permissions: [],
    profile: {
      id: 20,
      fullName: "User 2",
      birthday: null,
      avatarUrl: null,
      description: null,
      jobTitle: null,
      rankFull: "Trung tá",
      rankAbbr: "Tr.tá",
      department: "Phòng Tham mưu",
      phoneNumber: null,
      address: null,
      donViCapTren: null,
      donVi: null,
    },
  });

  assert.equal(mapped.profile.rankFull, "Trung tá");
  assert.equal(mapped.profile.rankAbbr, "Tr.tá");
  assert.equal(mapped.profile.department, "Phòng Tham mưu");
});
