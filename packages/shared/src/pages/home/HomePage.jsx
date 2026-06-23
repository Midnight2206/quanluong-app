"use client";

import {
  Bot,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Package,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useCheckGoogleDriveLinkMutation,
  useLazyGetCurrentUserQuery,
  useUnlinkGoogleDriveMutation,
} from "@/features/auth/api/authApi";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { getApiBaseUrl } from "@/utils/runtimeEnv";

const GOOGLE_DRIVE_ERROR_MESSAGES = {
  denied: "Bạn đã hủy cấp quyền hoặc Google từ chối liên kết.",
  missing: "Thiếu mã xác nhận từ Google. Hãy bắt đầu lại từ nút «Liên kết Google Drive».",
  state: "Phiên liên kết không khớp hoặc đã hết hạn. Mở lại từ trang chủ (đã đăng nhập) và thử liên kết lại.",
  no_refresh:
    "Google không cấp refresh token. Vào Tài khoản Google → Bảo mật → Quyền truy cập của bên thứ ba, gỡ ứng dụng này rồi liên kết lại.",
  config: "Google OAuth chưa được cấu hình đúng trên máy chủ (CLIENT_ID / SECRET / REDIRECT_URI).",
  folder: "Không tạo hoặc tìm được thư mục «midnight-app» trên Drive. Thử lại sau vài phút.",
  scope: "Google chưa cấp quyền tạo thư mục Drive. Hãy gỡ quyền ứng dụng trong Google Account rồi liên kết lại.",
  token: "Google không trả về access token hợp lệ. Thử liên kết lại.",
  unknown: "Liên kết Google Drive thất bại. Thử lại hoặc kiểm tra cấu hình OAuth.",
};

const features = [
  {
    icon: Package,
    title: "Nhập xuất thực phẩm thông minh",
    description:
      "Theo dõi và quản lý luồng nhập xuất lượng thực phẩm rõ ràng, gọn gàng và phù hợp quy trình kiểm soát tại đơn vị.",
  },
  {
    icon: FileSpreadsheet,
    title: "Google Workspace cho sổ sách",
    description:
      "Kết hợp Google Apps Script, Google Docs và Google Sheets để tự động hóa ghi chép, đối soát và lưu trữ sổ sách hàng ngày.",
  },
  {
    icon: UtensilsCrossed,
    title: "AI gợi ý thực đơn",
    description:
      "Tích hợp AI hỗ trợ xây dựng thực đơn hợp lý, đa dạng và bám sát nguyên liệu — giảm thời gian lên kế hoạch bếp.",
  },
  {
    icon: Bot,
    title: "Báo cáo tự động qua Telegram",
    description:
      "Dùng AI cùng Telegram bot để gửi báo cáo định kỳ hoặc cảnh báo, giúp lãnh đạo nắm nhanh tình hình mà không cần vào bảng biểu thủ công.",
  },
];

function CtaLink({ href, variant = "primary", title, children }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const variants = {
    primary:
      "border border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:brightness-[1.06] active:brightness-95",
    secondary:
      "border-2 border-border/90 bg-card text-foreground shadow-sm hover:bg-muted/90 hover:border-primary/35",
  };
  return (
    <Link href={href} title={title} className={cn(base, variants[variant])}>
      {children}
    </Link>
  );
}

export function HomePage() {
  const user = useCurrentUser();
  const isAuthenticated = useIsAuthenticated();
  const displayName = user?.profile?.fullName || user?.username;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const googleParam = searchParams.get("google");
  const googleReasonParam = searchParams.get("reason");
  const [refetchUser] = useLazyGetCurrentUserQuery();
  const [unlinkDrive, { isLoading: unlinkingDrive }] = useUnlinkGoogleDriveMutation();
  const [checkDriveLink] = useCheckGoogleDriveLinkMutation();
  const checkedDriveFolderRef = useRef(null);
  const handledGoogleResultRef = useRef(null);
  const { confirm } = useConfirm();
  const [driveLinkBusy, setDriveLinkBusy] = useState(false);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    const g = googleParam;
    const reason = googleReasonParam;
    const resultKey = `${g || ""}:${reason || ""}`;
    if ((g === "linked" || g === "error") && handledGoogleResultRef.current === resultKey) {
      return;
    }
    if (g === "linked") {
      handledGoogleResultRef.current = resultKey;
      notifySuccess("Đã liên kết Google Drive. Thư mục «midnight-app» sẵn sàng cho sổ sách.");
      void refetchUser();
      const next = new URLSearchParams(searchParams.toString());
      next.delete("google");
      next.delete("reason");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    } else if (g === "error") {
      handledGoogleResultRef.current = resultKey;
      const msg =
        (reason && GOOGLE_DRIVE_ERROR_MESSAGES[reason]) || GOOGLE_DRIVE_ERROR_MESSAGES.unknown;
      notifyError(msg);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("google");
      next.delete("reason");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams thay đổi mỗi render; chỉ cần scalar google* + pathname + router.
  }, [googleParam, googleReasonParam, pathname, refetchUser, router]);

  useEffect(() => {
    const folderId = user?.googleDriveFolderId;
    if (!folderId || checkedDriveFolderRef.current === folderId) {
      return;
    }
    checkedDriveFolderRef.current = folderId;
    let cancelled = false;
    async function checkLinkedFolder() {
      try {
        const nextUser = await checkDriveLink().unwrap();
        if (!cancelled && !nextUser?.googleDriveFolderId) {
          notifyError("Folder làm việc trên Google Drive không còn tồn tại. Hệ thống đã huỷ liên kết cũ.");
        }
      } catch {
        // Không chặn trang chủ nếu Google tạm thời không phản hồi.
      }
    }
    void checkLinkedFolder();
    return () => {
      cancelled = true;
    };
  }, [checkDriveLink, user?.googleDriveFolderId]);

  const canLinkDrive = isAuthenticated;

  const mayUseDriveLink = Boolean(
    user?.emailVerified || user?.type?.name === "superadmin",
  );

  const driveFolderUrl = useMemo(() => {
    const id = user?.googleDriveFolderId;
    if (!id) {
      return null;
    }
    return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
  }, [user?.googleDriveFolderId]);

  async function startGoogleDriveLink() {
    setDriveLinkBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/google/drive/authorize-url`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        notifyError(
          body?.message ||
            "Phiên đăng nhập không hợp lệ. Đăng xuất, đăng nhập lại trên cùng địa chỉ (localhost hoặc 127.0.0.1, không trộn), rồi thử lại.",
        );
        return;
      }
      if (!res.ok) {
        notifyError(body?.message || "Không bắt đầu được liên kết Google Drive.");
        return;
      }
      const url = body?.data?.url;
      if (typeof url !== "string" || !url.startsWith("https://")) {
        notifyError("Máy chủ không trả về URL Google hợp lệ.");
        return;
      }
      window.location.assign(url);
    } catch {
      notifyError("Lỗi mạng. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setDriveLinkBusy(false);
    }
  }

  async function handleUnlinkDrive() {
    const ok = await confirm({
      title: "Huỷ liên kết Google Drive",
      message:
        "Hệ thống sẽ xóa token và folder ID đã lưu. Thư mục trên Drive của bạn không bị xóa. Bạn có thể liên kết lại sau.",
      confirmLabel: "Huỷ liên kết",
    });
    if (!ok) {
      return;
    }
    try {
      await unlinkDrive().unwrap();
      notifySuccess("Đã huỷ liên kết Google Drive.");
    } catch (e) {
      notifyError(e?.data?.message || "Không gỡ được liên kết.");
    }
  }

  return (
    <div className="space-y-12 pb-2">
      <section className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            QUẢN LÝ QUÂN LƯƠNG HIỆU QUẢ, HIỆN ĐẠI
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Nền tảng hướng tới quy trình số hóa: từ nhập xuất kho đến sổ sách trên
            Google, thực đơn có hỗ trợ AI và báo cáo tự động qua Telegram — gói
            gọn trong một trục làm việc thống nhất.
          </p>
          <p className="text-sm text-muted-foreground">
            Một số tính năng đang được mở rộng theo roadmap; bạn có thể đăng nhập
            để truy cập các module nội bộ đã bật.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="flex flex-wrap gap-3">
            <CtaLink href="/login" variant="primary" title="Mở trang đăng nhập">
              Đăng nhập
            </CtaLink>
            <CtaLink href="/register" variant="secondary" title="Mở trang đăng ký tài khoản">
              Đăng ký tài khoản
            </CtaLink>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5 shadow-none">
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm font-medium text-foreground">
                  Xin chào, {displayName || "bạn"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Dùng thanh bên để mở Bảng điều khiển, Người dùng, Lộ trình và các
                  mục khác khi đã được cấp quyền. Trang chủ này luôn mô tả tổng quan sản
                  phẩm.
                </p>
                <CtaLink href="/dashboard" variant="primary" title="Mở bảng điều khiển theo quyền">
                  Vào bảng điều khiển
                </CtaLink>
              </CardContent>
            </Card>

            {canLinkDrive ? (
              <Card className="shadow-soft">
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <Cloud className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm font-medium text-foreground">Google Drive — sổ sách</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Liên kết một lần để tạo thư mục{" "}
                        <span className="font-mono text-[11px]">midnight-app</span> trên Drive của bạn, kèm{" "}
                        <span className="font-mono text-[11px]">chung-tu-quyet-toan-template</span> (mẫu) và{" "}
                        <span className="font-mono text-[11px]">chung-tu-quyet-toan-generated</span> (chứng từ đã tạo).
                        Đặt Google Sheets/Docs mẫu vào các thư mục con theo loại chứng từ (vd.{" "}
                        <span className="font-mono text-[11px]">bang-ke-mua-hang</span>). Luồng OAuth: bấm liên kết →
                        đăng nhập Google → chấp nhận quyền → trình duyệt quay về trang chủ. Dùng cùng địa chỉ trang (vd.
                        luôn localhost:8080, không trộn với 127.0.0.1).
                      </p>
                      {user?.googleDriveFolderId ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">Đã liên kết.</span> Folder ID:{" "}
                          <span className="break-all font-mono">{user.googleDriveFolderId}</span>
                        </p>
                      ) : !mayUseDriveLink ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-200">
                          Hoàn tất xác minh email trước khi liên kết Drive (trừ tài khoản quản trị hệ thống).
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {mayUseDriveLink && user?.googleDriveFolderId && driveFolderUrl ? (
                      <>
                        <a
                          href={driveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow-md transition hover:brightness-[1.06]",
                          )}
                        >
                          <ExternalLink className="size-4 shrink-0" aria-hidden />
                          Mở thư mục làm việc
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive sm:self-end"
                          disabled={unlinkingDrive}
                          onClick={() => void handleUnlinkDrive()}
                        >
                          {unlinkingDrive ? "Đang huỷ…" : "Huỷ liên kết"}
                        </Button>
                      </>
                    ) : null}
                    {mayUseDriveLink && !user?.googleDriveFolderId ? (
                      <button
                        type="button"
                        disabled={driveLinkBusy}
                        onClick={() => void startGoogleDriveLink()}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow-md transition hover:brightness-[1.06] disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        {driveLinkBusy ? "Đang mở Google…" : "Liên kết Google Drive"}
                      </button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Tính năng nổi bật</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bốn trụ cột chính mà ứng dụng hướng tới.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="h-full shadow-soft">
              <CardContent className="flex h-full flex-col gap-3 pt-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-base font-semibold leading-snug">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
