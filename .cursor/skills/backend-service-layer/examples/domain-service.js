export const makePayrollService = ({
  payrollRepository,
  auditPublisher,
}) => ({
  async approveRun({ runId, approverId }) {
    const run = await payrollRepository.findById(runId);

    if (!run) {
      const error = new Error("Payroll run not found.");
      error.code = "PAYROLL_RUN_NOT_FOUND";
      throw error;
    }

    const updatedRun = await payrollRepository.markApproved({
      runId,
      approverId,
    });

    await auditPublisher.publish({
      type: "payroll.run.approved",
      payload: { runId, approverId },
    });

    return updatedRun;
  },
});
