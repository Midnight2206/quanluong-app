"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useResetPasswordMutation } from "@/features/auth/api/authApi";
import { resetPasswordSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";

export function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  async function onSubmit(values) {
    if (!token) {
      notifyError("Thiếu token trong liên kết. Hãy mở đúng URL trong email.");
      return;
    }
    try {
      const res = await resetPassword({
        token,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      }).unwrap();
      notifySuccess(res?.message || "Đã đặt lại mật khẩu.");
      router.replace("/login");
    } catch (error) {
      notifyError(
        error?.data?.message || "Không đặt lại được mật khẩu. Liên kết có thể đã hết hạn.",
      );
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Liên kết không hợp lệ</h1>
        <p className="text-sm text-muted-foreground">
          Thiếu mã trong URL. Hãy dùng đúng liên kết trong email hoặc yêu cầu gửi lại từ trang quên mật
          khẩu.
        </p>
        <Link
          href="/forgot-password"
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border/90 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/90",
          )}
        >
          Yêu cầu liên kết mới
        </Link>
        <p className="text-sm">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Đặt lại mật khẩu</h1>
        <p className="text-sm text-muted-foreground">Nhập mật khẩu mới (tối thiểu 8 ký tự).</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block space-y-2" htmlFor="ql-reset-new-password">
          <span className="text-sm font-medium">Mật khẩu mới</span>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-2xl border bg-background py-3 pl-4 pr-12 text-sm outline-none ring-0 transition focus:border-primary"
              {...register("newPassword")}
              id="ql-reset-new-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.newPassword ? (
            <p className="text-sm text-destructive">{errors.newPassword.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-reset-confirm-password">
          <span className="text-sm font-medium">Xác nhận mật khẩu</span>
          <div className="relative">
            <input
              type={showPw2 ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-2xl border bg-background py-3 pl-4 pr-12 text-sm outline-none ring-0 transition focus:border-primary"
              {...register("confirmNewPassword")}
              id="ql-reset-confirm-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPw2((v) => !v)}
              aria-label={showPw2 ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPw2 ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirmNewPassword ? (
            <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>
          ) : null}
        </label>

        <Button className="w-full gap-2" type="submit" disabled={isLoading} title="Lưu mật khẩu mới">
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="size-4 shrink-0" aria-hidden />
          )}
          <span>{isLoading ? "Đang lưu…" : "Lưu mật khẩu mới"}</span>
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
