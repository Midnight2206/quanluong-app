"use client";

import { Loader2, Mail, MailCheck, MailX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import httpClient from "@/services/httpClient";
import { cn } from "@/utils/cn";

const primaryLinkClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md shadow-primary/15 transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const outlineLinkClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 border-border/90 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/90";

export function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [phase, setPhase] = useState(() => (token ? "idle" : "error"));
  const [message, setMessage] = useState(() =>
    token ? "" : "Thiếu liên kết xác minh. Hãy dùng đúng URL trong email.",
  );

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setMessage("Thiếu liên kết xác minh. Hãy dùng đúng URL trong email.");
      return;
    }
    setPhase("idle");
    setMessage("");
  }, [token]);

  const runVerify = useCallback(async () => {
    if (!token || phase !== "idle") {
      return;
    }
    setPhase("loading");
    try {
      const res = await httpClient.get("/auth/verify-email", {
        params: { token },
        skipTargetUnitHeader: true,
      });
      setPhase("ok");
      setMessage(res.data?.message || "Email đã được xác minh.");
    } catch (err) {
      setPhase("error");
      setMessage(
        err.response?.data?.message ||
          "Liên kết không hợp lệ hoặc đã hết hạn. Yêu cầu gửi lại email nếu cần.",
      );
    }
  }, [token, phase]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center">
      {phase === "idle" && token ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="size-7" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Xác minh email</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Chỉ bấm một lần. Trong lúc hệ thống xử lý, nút sẽ khóa để tránh gửi trùng yêu cầu.
            </p>
          </div>
          <Button type="button" className="w-full max-w-xs" onClick={runVerify} title="Gửi yêu cầu xác minh">
            Xác minh email
          </Button>
          <p className="text-xs text-muted-foreground">
            Sai link hoặc hết hạn?{" "}
            <Link href="/verify-email/resend" className="font-medium text-primary underline-offset-4 hover:underline">
              Gửi lại email
            </Link>
          </p>
        </>
      ) : null}

      {phase === "loading" ? (
        <>
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Đang xác minh email…</p>
          <p className="text-xs text-muted-foreground">Vui lòng không đóng trang.</p>
          <Button type="button" className="w-full max-w-xs" disabled title="Đang xử lý">
            Đang xử lý…
          </Button>
        </>
      ) : null}

      {phase === "ok" ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-7" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Xác minh thành công</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>
          <Link href="/login" className={cn(primaryLinkClass, "w-full sm:w-auto")}>
            Đăng nhập
          </Link>
        </>
      ) : null}

      {phase === "error" ? (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <MailX className="size-7" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Không xác minh được</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/verify-email/resend" className={outlineLinkClass}>
              Gửi lại email
            </Link>
            <Link href="/register" className={outlineLinkClass}>
              Đăng ký lại
            </Link>
            <Link
              href="/login"
              className={cn(outlineLinkClass, "border-transparent bg-transparent shadow-none hover:bg-muted/80")}
            >
              Đăng nhập
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
