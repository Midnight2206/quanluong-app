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
      rank: null,
      phoneNumber: null,
      address: null,
      donViCapTren: "Sư đoàn 372",
      donVi: "Tiểu đoàn 1",
    },
  });

  assert.equal(mapped.profile.donViCapTren, "Sư đoàn 372");
  assert.equal(mapped.profile.donVi, "Tiểu đoàn 1");
});
