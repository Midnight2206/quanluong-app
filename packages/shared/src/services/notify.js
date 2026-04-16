import { toast as sonnerToast } from "sonner";

function notifySuccess(message, options) {
  sonnerToast.success(message, options);
}

/** Toast thành công với nút hoàn tác (ví dụ sonner `action`). */
function notifySuccessWithUndo(message, onUndo, { undoLabel = "Hoàn tác", duration = 8000 } = {}) {
  sonnerToast.success(message, {
    duration,
    action: {
      label: undoLabel,
      onClick: () => {
        onUndo?.();
      },
    },
  });
}

function notifyError(message) {
  sonnerToast.error(message);
}

function notifyWarning(message) {
  sonnerToast.warning(message);
}

export { notifyChatIncoming } from "./notifyChatIncoming.jsx";

export { notifySuccess, notifySuccessWithUndo, notifyError, notifyWarning };
