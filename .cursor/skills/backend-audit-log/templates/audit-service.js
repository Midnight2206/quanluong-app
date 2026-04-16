import { createAuditEvent } from "./audit-event";

export const makeAuditService = ({ prisma }) => ({
  async record(input, tx = prisma) {
    const event = createAuditEvent(input);

    return tx.auditLog.create({
      data: event,
    });
  },
});
