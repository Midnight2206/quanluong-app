"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useForgotPasswordMutation } from "@/features/auth/api/authApi";
import { forgotPasswordSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";

export function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values) {
    try {
      const res = await forgotPassword(values).unwrap();
      notifySuccess(res?.message || "Đã xử lý yêu cầu.");
    } catch (error) {
      notifyError(error?.data?.message || "Không gửi được yêu cầu. Thử lại sau.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Quên mật khẩu</h1>
        <p className="text-sm text-muted-foreground">
          Nhập email đã đăng ký. Nếu tài khoản tồn tại, bạn sẽ nhận liên kết đặt lại mật khẩu (hiệu lực 1
          giờ).
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block space-y-2" htmlFor="ql-forgot-email">
          <span className="text-sm font-medium">Email</span>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl border bg-background py-3 pl-10 pr-4 text-sm outline-none ring-0 transition focus:border-primary"
              placeholder="you@example.com"
              {...register("email")}
              id="ql-forgot-email"
            />
          </div>
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </label>

        <Button className="w-full gap-2" type="submit" disabled={isLoading} title="Gửi liên kết">
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Mail className="size-4 shrink-0" aria-hidden />
          )}
          <span>{isLoading ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}</span>
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
