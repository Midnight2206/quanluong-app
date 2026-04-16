import { addNotification } from "../templates/notification-store";

export const notifyApprovalCreated = ({ dispatch, approvalId }) => {
  dispatch(
    addNotification({
      id: `approval-${approvalId}`,
      title: "Approval created",
      message: "A new approval request is waiting for review.",
      severity: "info",
      createdAt: new Date().toISOString(),
      isRead: false,
      actionLabel: "Open",
      actionHref: `/approvals/${approvalId}`,
      source: "approval-flow",
    }),
  );
};
