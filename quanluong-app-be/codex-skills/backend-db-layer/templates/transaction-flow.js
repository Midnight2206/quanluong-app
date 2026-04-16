import { prisma } from "./prisma-client";

export const createPayrollRunWithItems = async ({ runData, items }) => {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: runData,
    });

    await tx.payrollItem.createMany({
      data: items.map((item) => ({
        ...item,
        runId: run.id,
      })),
    });

    return run;
  });
};
