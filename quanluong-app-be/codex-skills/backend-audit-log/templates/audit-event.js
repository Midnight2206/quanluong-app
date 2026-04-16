export const createAuditEvent = ({
  action,
  actorId,
  entityType,
  entityId,
  summary,
  metadata = {},
}) => ({
  action,
  actorId,
  entityType,
  entityId,
  summary,
  metadata,
  createdAt: new Date(),
});
