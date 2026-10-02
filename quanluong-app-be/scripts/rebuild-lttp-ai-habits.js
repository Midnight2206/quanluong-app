#!/usr/bin/env node
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { rebuildCommodityHabits } from "../src/modules/lttp/lttp-issue-slip-ai-backfill.js";

const result = await rebuildCommodityHabits(prisma);
console.log(`Rebuilt ${result.groups} LTTP commodity habit rows`);
await prisma.$disconnect();
