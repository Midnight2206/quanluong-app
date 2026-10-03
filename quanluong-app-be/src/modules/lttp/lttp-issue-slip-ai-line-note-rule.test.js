import assert from "node:assert/strict";
import test from "node:test";

import { loadOriginalQtyOnConvert, setOriginalQtyOnConvert } from "./lttp-issue-slip-ai-learn.js";

test("depth 0 and enabled true => true", async () => {
  const prisma = {
    unit: {
      findUnique: async () => ({ depth: 0 }),
    },
    lttpAiLineNoteRule: {
      findUnique: async () => ({ enabled: true }),
    },
  };
  assert.equal(await loadOriginalQtyOnConvert(prisma, 123), true);
});

test("depth 0 and no row => false", async () => {
  const prisma = {
    unit: {
      findUnique: async () => ({ depth: 0 }),
    },
    lttpAiLineNoteRule: {
      findUnique: async () => null,
    },
  };
  assert.equal(await loadOriginalQtyOnConvert(prisma, 123), false);
});

test("depth 1 and enabled true => false", async () => {
  const prisma = {
    unit: {
      findUnique: async () => ({ depth: 1 }),
    },
    lttpAiLineNoteRule: {
      findUnique: async () => ({ enabled: true }),
    },
  };
  assert.equal(await loadOriginalQtyOnConvert(prisma, 123), false);
});

test("missing lttpAiLineNoteRule => false", async () => {
  const prisma = {
    unit: {
      findUnique: async () => ({ depth: 0 }),
    },
  };
  assert.equal(await loadOriginalQtyOnConvert(prisma, 123), false);
});

test("setter updates an existing line-note rule", async () => {
  const updated = [];
  const prisma = {
    lttpAiLineNoteRule: {
      findUnique: async () => ({ id: 5, enabled: false }),
      update: async ({ data }) => {
        updated.push(data);
        return { id: 5, enabled: data.enabled };
      },
      create: async () => {
        throw new Error("should not create");
      },
    },
  };
  assert.deepEqual(await setOriginalQtyOnConvert(prisma, true), {
    previous: false,
    created: false,
  });
  assert.deepEqual(updated, [{ enabled: true }]);
});

test("setter creates the line-note rule when missing", async () => {
  const created = [];
  const prisma = {
    lttpAiLineNoteRule: {
      findUnique: async () => null,
      update: async () => {
        throw new Error("should not update");
      },
      create: async ({ data }) => {
        created.push(data);
        return data;
      },
    },
  };
  assert.deepEqual(await setOriginalQtyOnConvert(prisma, true), {
    previous: false,
    created: true,
  });
  assert.deepEqual(created, [{ kind: "originalQtyOnConvert", enabled: true }]);
});
