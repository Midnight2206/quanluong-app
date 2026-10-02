#!/usr/bin/env node
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { loadLttpAiQuality, summarizeLttpAiQuality } from "../src/modules/lttp/lttp-issue-slip-ai-quality.js";

const report = summarizeLttpAiQuality(await loadLttpAiQuality(prisma));
console.log(`Phiếu đã chốt: ${report.slips}`);
console.log(`Dòng: ${report.lines}`);
console.log(`Đúng không cần sửa: ${report.pctCorrectNoEdit}%`);
console.log(`Cần xác nhận: ${report.pctNeedsConfirm}%`);
console.log(
  `Đã sửa theo nguồn — alias ${report.pctEditedBySource.alias}%, chấm điểm ${report.pctEditedBySource.score}%, LLM ${report.pctEditedBySource.llm}%, khác ${report.pctEditedBySource.other}%`,
);
console.log(`Lượt chat trung bình mỗi phiếu: ${report.meanChatTurns}`);
console.log(`Lần gọi LLM trung bình mỗi phiếu: ${report.meanLlmCalls}`);
await prisma.$disconnect();
