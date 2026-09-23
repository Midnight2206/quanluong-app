"use client";

import { useCallback } from "react";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useLogoutMutation } from "@/features/auth/api/authApi";
import { listLocalDraftEntries } from "@/lib/clientPersist/localDraftRegistry.js";

/**
 * Logout with confirm when content drafts still exist locally.
 * @returns {{ logoutWithDraftGuard: () => Promise<boolean>, isLoggingOut: boolean }}
 */
export function useLogoutWithDraftGuard() {
  const { confirm } = useConfirm();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const logoutWithDraftGuard = useCallback(async () => {
    const drafts = listLocalDraftEntries();
    if (drafts.length > 0) {
      const preview = drafts
        .slice(0, 5)
        .map((d) => `• ${d.label}`)
        .join("\n");
      const more =
        drafts.length > 5 ? `\n… và ${drafts.length - 5} mục khác` : "";
      const ok = await confirm({
        title: "Còn dữ liệu tạm trên máy",
        message: `Máy này còn nháp chưa gửi máy chủ:\n${preview}${more}\n\nĐăng xuất sẽ xoá bộ nhớ tạm (nháp / cache offline) trên trình duyệt này.`,
        confirmLabel: "Đăng xuất và xoá bộ nhớ tạm",
        cancelLabel: "Huỷ",
        variant: "danger",
      });
      if (!ok) {
        return false;
      }
    }
    try {
      await logout().unwrap();
      return true;
    } catch {
      return false;
    }
  }, [confirm, logout]);

  return { logoutWithDraftGuard, isLoggingOut };
}
