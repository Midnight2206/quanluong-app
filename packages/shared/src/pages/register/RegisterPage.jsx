"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  useGetRegisterUnitsQuery,
  useRegisterMutation,
} from "@/features/auth/api/authApi";
import { registerSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";

/**
 * @param {{ initialUnits?: unknown[], initialUnitsError?: boolean }} props
 * Khi có `initialUnits` (kể cả []), danh sách đơn vị lấy từ RSC — bỏ query RTK.
 */
export function RegisterPage({ initialUnits, initialUnitsError = false } = {}) {
  const router = useRouter();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [forceClientUnits, setForceClientUnits] = useState(false);
  const hydrateFromServer = initialUnits !== undefined && !initialUnitsError && !forceClientUnits;
  const rtk = useGetRegisterUnitsQuery(undefined, {
    skip: hydrateFromServer,
    retry: 1,
  });
  const units = hydrateFromServer
    ? Array.isArray(initialUnits)
      ? initialUnits
      : []
    : (rtk.data ?? []);
  const isLoadingUnits = hydrateFromServer ? false : rtk.isLoading;
  const unitsFetchFailed = hydrateFromServer ? Boolean(initialUnitsError) : rtk.isError;
  const [registerMutation, { isLoading }] = useRegisterMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      unitId: "",
    },
  });

  async function onSubmit(values) {
    try {
      const result = await registerMutation({
        username: values.username,
        email: values.email,
        password: values.password,
        unitId: values.unitId,
      }).unwrap();

      if (result?.pending) {
        notifySuccess(
          "Đã gửi đăng ký. Tài khoản sẽ được kích hoạt sau khi quản trị đơn vị trong nhánh của bạn duyệt.",
        );
        router.replace("/login");
        return;
      }

      if (result?.needsVerification) {
        notifySuccess(
          "Đã tạo tài khoản. Kiểm tra email và bấm liên kết xác minh trước khi đăng nhập.",
        );
        router.replace("/login");
        return;
      }

      notifySuccess("Đăng ký thành công");
      router.replace("/");
    } catch (error) {
      notifyError(error?.data?.message || "Đăng ký thất bại.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
          Đăng ký
        </p>
        <h1 className="text-3xl font-semibold">Tạo tài khoản mới</h1>
        <p className="text-sm text-muted-foreground">
          Chọn đúng đơn vị trực thuộc. Sau khi gửi form, tài khoản chờ quản trị đơn vị
          đủ cấp trong nhánh tổ chức duyệt mới đăng nhập được.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block space-y-2" htmlFor="ql-register-username">
          <span className="text-sm font-medium">Username</span>
          <input
            type="text"
            autoComplete="username"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary aria-invalid:border-destructive"
            placeholder="nguyenvana"
            {...register("username")}
            id="ql-register-username"
            aria-invalid={errors.username ? "true" : undefined}
            aria-describedby={errors.username ? "ql-register-username-error" : undefined}
          />
          {errors.username ? (
            <p id="ql-register-username-error" role="alert" className="text-sm text-destructive">
              {errors.username.message}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-email">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary aria-invalid:border-destructive"
            placeholder="ban@domain.com"
            {...register("email")}
            id="ql-register-email"
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "ql-register-email-error" : undefined}
          />
          {errors.email ? (
            <p id="ql-register-email-error" role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-password">
          <span className="text-sm font-medium">Mật khẩu</span>
          <div className="relative">
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-2xl border bg-background px-4 py-3 pr-12 text-sm outline-none transition focus:border-primary aria-invalid:border-destructive"
              placeholder="Nhập mật khẩu"
              {...register("password")}
              id="ql-register-password"
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? "ql-register-password-error" : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground transition hover:text-foreground"
              onClick={() => setIsPasswordVisible((value) => !value)}
              aria-label={isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p id="ql-register-password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-unitId">
          <span className="text-sm font-medium">Đơn vị</span>
          <select
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary aria-invalid:border-destructive"
            disabled={isLoadingUnits || !units.length}
            {...register("unitId")}
            id="ql-register-unitId"
            aria-invalid={errors.unitId ? "true" : undefined}
            aria-describedby={
              errors.unitId
                ? "ql-register-unitId-error"
                : !isLoadingUnits && !units.length
                  ? "ql-register-unitId-hint"
                  : undefined
            }
          >
            <option value="">
              {isLoadingUnits ? "Đang tải đơn vị..." : "Chọn đơn vị"}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          {errors.unitId ? (
            <p id="ql-register-unitId-error" role="alert" className="text-sm text-destructive">
              {errors.unitId.message}
            </p>
          ) : null}
          {!isLoadingUnits && !units.length ? (
            <div id="ql-register-unitId-hint" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {unitsFetchFailed
                  ? "Không tải được danh sách đơn vị. Thử tải lại hoặc liên hệ quản trị."
                  : "Hiện chưa có đơn vị khả dụng để đăng ký."}
              </p>
              {unitsFetchFailed ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isLoadingUnits}
                  onClick={() => {
                    setForceClientUnits(true);
                    void rtk.refetch();
                  }}
                >
                  {isLoadingUnits ? "Đang tải…" : "Tải lại danh sách đơn vị"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </label>

        <Button
          className="w-full gap-2"
          type="submit"
          disabled={isLoading || isLoadingUnits || !units.length}
          title="Gửi đăng ký"
        >
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="size-4 shrink-0" aria-hidden />
          )}
          <span>{isLoading ? "Đang tạo tài khoản…" : "Đăng ký"}</span>
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link className="font-medium text-primary" href="/login">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
