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
  const hydrateFromServer = initialUnits !== undefined;
  const rtk = useGetRegisterUnitsQuery(undefined, { skip: hydrateFromServer });
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
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="nguyenvana"
            {...register("username")}
            id="ql-register-username"
          />
          {errors.username ? (
            <p className="text-sm text-destructive">{errors.username.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-email">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
            placeholder="ban@domain.com"
            {...register("email")}
            id="ql-register-email"
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-password">
          <span className="text-sm font-medium">Mật khẩu</span>
          <div className="relative">
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-2xl border bg-background px-4 py-3 pr-12 text-sm outline-none transition focus:border-primary"
              placeholder="Nhập mật khẩu"
              {...register("password")}
              id="ql-register-password"
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
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-register-unitId">
          <span className="text-sm font-medium">Đơn vị</span>
          <select
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
            disabled={isLoadingUnits || !units.length}
            {...register("unitId")}
            id="ql-register-unitId"
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
            <p className="text-sm text-destructive">{errors.unitId.message}</p>
          ) : null}
          {!isLoadingUnits && !units.length ? (
            <p className="text-xs text-muted-foreground">
              {unitsFetchFailed
                ? "Không tải được danh sách đơn vị. Thử tải lại trang hoặc liên hệ quản trị."
                : "Hiện chưa có đơn vị khả dụng để đăng ký."}
            </p>
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
