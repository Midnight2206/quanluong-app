"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useLoginMutation } from "@/features/auth/api/authApi";
import { loginSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";

export function ReauthOverlay({ onSuccess }) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [login, { isLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  async function onSubmit(values) {
    try {
      await login(values).unwrap();
      notifySuccess("Đăng nhập thành công");
      await onSuccess?.();
    } catch (error) {
      notifyError(error?.data?.message || "Đăng nhập thất bại.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ql-reauth-title"
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
        <h2 id="ql-reauth-title" className="text-lg font-semibold">
          Phiên hết hạn, đăng nhập lại
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhập lại tên đăng nhập hoặc email và mật khẩu để tiếp tục đồng bộ.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="block space-y-2" htmlFor="ql-reauth-identifier">
            <span className="text-sm font-medium">Username hoặc email</span>
            <input
              type="text"
              autoComplete="username"
              className="w-full px-4 py-3 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary aria-invalid:border-destructive"
              placeholder="username hoặc email đã đăng ký"
              {...register("identifier")}
              id="ql-reauth-identifier"
              aria-invalid={errors.identifier ? "true" : undefined}
              aria-describedby={errors.identifier ? "ql-reauth-identifier-error" : undefined}
            />
            {errors.identifier ? (
              <p id="ql-reauth-identifier-error" role="alert" className="text-sm text-destructive">
                {errors.identifier.message}
              </p>
            ) : null}
          </label>

          <label className="block space-y-2" htmlFor="ql-reauth-password">
            <span className="text-sm font-medium">Mật khẩu</span>
            <div className="relative">
              <input
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary aria-invalid:border-destructive"
                placeholder="Nhập mật khẩu"
                {...register("password")}
                id="ql-reauth-password"
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby={errors.password ? "ql-reauth-password-error" : undefined}
              />
              <button
                type="button"
                className="absolute inset-y-0 inline-flex items-center transition right-3 text-muted-foreground hover:text-foreground"
                onClick={() => setIsPasswordVisible((value) => !value)}
                aria-label={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p id="ql-reauth-password-error" role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </label>

          <Button
            className="w-full gap-2"
            type="submit"
            disabled={isLoading}
            title="Đăng nhập"
          >
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <LogIn className="size-4 shrink-0" aria-hidden />
            )}
            <span>{isLoading ? "Đang đăng nhập…" : "Đăng nhập"}</span>
          </Button>
        </form>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          Cần đăng nhập bằng Google?{" "}
          <Link className="font-medium text-primary hover:underline" href="/login">
            Mở trang đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
