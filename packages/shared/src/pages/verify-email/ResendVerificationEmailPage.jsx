"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { Button } from "@/components/ui/Button";
import {
  useRequestVerificationEmailMutation,
  useRequestVerificationEmailPublicMutation,
} from "@/features/auth/api/authApi";
import {
  useAuthInitialized,
  useCurrentUser,
  useIsAuthenticated,
} from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const mutedLinkClass =
  "text-sm font-medium text-primary underline-offset-4 hover:underline";

export function ResendVerificationEmailPage() {
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const [email, setEmail] = useState("");
  const [requestAuth, { isLoading: loadingAuth }] = useRequestVerificationEmailMutation();
  const [requestPublic, { isLoading: loadingPublic }] = useRequestVerificationEmailPublicMutation();
  const loading = loadingAuth || loadingPublic;

  if (!initialized) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      </div>
    );
  }

  if (isAuthenticated && user?.emailVerified !== false) {
    return <ClientRedirect href="/" replace />;
  }

  async function sendAsLoggedIn() {
    try {
      const body = await requestAuth().unwrap();
      notifySuccess(body.message || "Đã gửi email xác minh.");
    } catch (err) {
      notifyError(err?.data?.message || "Không gửi được email. Thử lại sau.");
    }
  }

  async function sendAsGuest(e) {
    e.preventDefault();
    if (!email.trim()) {
      notifyError("Nhập địa chỉ email đã đăng ký.");
      return;
    }
    try {
      const body = await requestPublic({ email: email.trim() }).unwrap();
      notifySuccess(body.message || "Đã xử lý yêu cầu.");
    } catch (err) {
      notifyError(err?.data?.message || "Không gửi được email. Thử lại sau.");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold">Gửi lại email xác minh</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hệ thống gửi thư qua hàng đợi (worker). Trong email có nút dẫn tới trang xác minh kèm mã token.
        </p>
      </div>

      {isAuthenticated ? (
        <div className="space-y-4 rounded-2xl border border-border/80 bg-card/50 p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Gửi lại thư tới <span className="font-medium text-foreground">{user?.email}</span>
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={sendAsLoggedIn}
            title="Gửi email xác minh"
          >
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            <span>{loading ? "Đang gửi…" : "Gửi email xác minh"}</span>
          </Button>
        </div>
      ) : (
        <form className="space-y-4 rounded-2xl border border-border/80 bg-card/50 p-5 shadow-sm" onSubmit={sendAsGuest} noValidate>
          <label className="block space-y-2" htmlFor="ql-resend-verification-email">
            <span className="text-sm font-medium">Email đã đăng ký</span>
            <input
              id="ql-resend-verification-email"
              name="email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary"
              placeholder="ban@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
          <Button type="submit" className="w-full" disabled={loading} title="Gửi email xác minh">
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            <span>{loading ? "Đang gửi…" : "Gửi email xác minh"}</span>
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/verify-email" className={cn(mutedLinkClass)}>
          Đã có liên kết từ email?
        </Link>
        {" · "}
        <Link href="/login" className={cn(mutedLinkClass)}>
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
