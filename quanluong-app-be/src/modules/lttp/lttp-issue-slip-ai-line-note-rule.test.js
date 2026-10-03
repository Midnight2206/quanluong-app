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
  const upserted = [];
  const prisma = {
    lttpAiLineNoteRule: {
      findUnique: async () => ({ id: 5, enabled: false }),
      upsert: async (args) => {
        upserted.push(args);
        return { id: 5, enabled: args.update.enabled };
      },
    },
  };
  assert.deepEqual(await setOriginalQtyOnConvert(prisma, true), {
    previous: false,
    created: false,
  });
  assert.deepEqual(upserted, [
    {
      where: { kind: "originalQtyOnConvert" },
      update: { enabled: true },
      create: { kind: "originalQtyOnConvert", enabled: true },
    },
  ]);
});

test("setter creates the line-note rule when missing", async () => {
  const upserted = [];
  const prisma = {
    lttpAiLineNoteRule: {
      findUnique: async () => null,
      upsert: async (args) => {
        upserted.push(args);
        return args.create;
      },
    },
  };
  assert.deepEqual(await setOriginalQtyOnConvert(prisma, true), {
    previous: false,
    created: true,
  });
  assert.deepEqual(upserted, [
    {
      where: { kind: "originalQtyOnConvert" },
      update: { enabled: true },
      create: { kind: "originalQtyOnConvert", enabled: true },
    },
  ]);
});
