"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { safeInternalPath } from "@/utils/postLoginPath";
import { Button } from "@/components/ui/Button";
import { useLoginMutation } from "@/features/auth/api/authApi";
import { loginSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      const next = safeInternalPath(searchParams.get("from"));
      router.replace(next);
    } catch (error) {
      notifyError(error?.data?.message || "Đăng nhập thất bại.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Đăng nhập vào hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Sử dụng tên đăng nhập hoặc email cùng với mật khẩu để truy cập hệ
          thống.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block space-y-2" htmlFor="ql-login-identifier">
          <span className="text-sm font-medium">Username hoặc email</span>
          <input
            type="text"
            autoComplete="username"
            className="w-full px-4 py-3 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary"
            placeholder="superadmin hoặc superadmin@quanluong.local"
            {...register("identifier")}
            id="ql-login-identifier"
          />
          {errors.identifier ? (
            <p className="text-sm text-destructive">{errors.identifier.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-login-password">
          <span className="text-sm font-medium">Mật khẩu</span>
          <div className="relative">
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary"
              placeholder="Nhập mật khẩu"
              {...register("password")}
              id="ql-login-password"
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
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </label>

        <p className="text-right text-sm">
          <Link className="font-medium text-primary hover:underline" href="/forgot-password">
            Quên mật khẩu?
          </Link>
        </p>

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
      <p className="text-sm text-center text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link className="font-medium text-primary" href="/register">
          Đăng ký ngay
        </Link>
      </p>
      <p className="text-sm text-center text-muted-foreground">
        Chưa nhận email xác minh?{" "}
        <Link className="font-medium text-primary" href="/verify-email/resend">
          Gửi lại
        </Link>
      </p>
    </div>
  );
}
