import assert from "node:assert/strict";
import test from "node:test";

import { loadOriginalQtyOnConvert } from "./lttp-issue-slip-ai-learn.js";

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
