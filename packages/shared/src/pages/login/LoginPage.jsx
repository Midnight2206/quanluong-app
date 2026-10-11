"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  navigateAfterLogin,
  isSuperadminUser,
  resolvePostLoginPath,
  safeInternalPath,
  SUPERADMIN_PORTAL_CHOOSER_PATH,
} from "@/utils/postLoginPath";
import { Button } from "@/components/ui/Button";
import { useLoginMutation } from "@/features/auth/api/authApi";
import { loginSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";
import { getApiBaseUrl } from "@/utils/runtimeEnv";
import { getSupplierAppOrigin } from "@/utils/supplierPortal";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";

const GOOGLE_LOGIN_ERROR_MESSAGES = {
  denied: "Bạn đã huỷ đăng nhập Google.",
  missing: "Google không trả về mã xác thực. Hãy thử lại.",
  state: "Phiên OAuth không hợp lệ hoặc đã hết hạn. Hãy thử lại.",
  config: "Máy chủ chưa cấu hình đăng nhập Google (GOOGLE_CLIENT_ID / GOOGLE_LOGIN_REDIRECT_URI).",
  no_account:
    "Không tìm thấy tài khoản với email Google này. Hãy đăng ký trước bằng email trùng khớp.",
  pending:
    "Tài khoản đang chờ quản trị đơn vị duyệt. Liên hệ quản trị trong nhánh đơn vị của bạn.",
  rejected: "Đăng ký của bạn đã bị từ chối. Liên hệ quản trị đơn vị.",
  email: "Email chưa được xác minh. Kiểm tra hộp thư hoặc dùng đăng nhập mật khẩu.",
  inactive: "Tài khoản không hoạt động hoặc không thể đăng nhập.",
  forbidden: "Không thể đăng nhập bằng Google với tài khoản này.",
  token: "Google từ chối mã đăng nhập. Hãy bấm «Đăng nhập bằng Google» và thử lại.",
  redirect_uri:
    "redirect_uri không khớp Google Console — kiểm tra GOOGLE_LOGIN_REDIRECT_URI trên server.",
  profile: "Không lấy được thông tin tài khoản Google. Thử lại sau.",
  unknown: "Đăng nhập Google thất bại. Hãy thử lại.",
};

const ZALO_LOGIN_ERROR_MESSAGES = {
  denied: "Bạn đã huỷ đăng nhập Zalo.",
  missing: "Zalo không trả về mã xác thực. Hãy thử lại.",
  state: "Phiên Zalo không hợp lệ hoặc đã hết hạn. Hãy thử lại.",
  config: "Máy chủ chưa cấu hình đăng nhập Zalo.",
  token: "Zalo từ chối mã đăng nhập. Hãy thử lại.",
  profile: "Không lấy được thông tin tài khoản Zalo. Thử lại sau.",
  forbidden: "Không thể đăng nhập bằng Zalo với tài khoản này.",
  inactive: "Tài khoản không hoạt động hoặc chưa được duyệt.",
  superadmin: "Không đăng nhập superadmin bằng Zalo.",
  unknown: "Đăng nhập Zalo thất bại. Hãy thử lại.",
};

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ZaloIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#0068FF" />
      <path
        fill="#fff"
        d="M6.8 7.2h6.4c2.5 0 4 1.3 4 3.3 0 1.5-.8 2.5-2.1 3l2.6 3.3h-2.5l-2.4-3.2H9.1v3.2H6.8V7.2zm2.3 1.7v2.6h3.7c1.2 0 1.9-.5 1.9-1.3s-.7-1.3-1.9-1.3H9.1z"
      />
    </svg>
  );
}

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBase = getApiBaseUrl();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  const [isZaloBusy, setIsZaloBusy] = useState(false);
  const [showZaloLogin, setShowZaloLogin] = useState(false);
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

  useEffect(() => {
    if (searchParams.get("google") !== "error") {
      return;
    }
    const reason = searchParams.get("reason") || "unknown";
    const detail = searchParams.get("msg");
    notifyError(
      detail ||
        GOOGLE_LOGIN_ERROR_MESSAGES[reason] ||
        GOOGLE_LOGIN_ERROR_MESSAGES.unknown,
    );
  }, [searchParams]);

  useEffect(() => {
    setShowZaloLogin(window.location.origin !== getSuperadminAppOrigin());
  }, []);

  useEffect(() => {
    if (searchParams.get("zalo") !== "error") {
      return;
    }
    const reason = searchParams.get("reason") || "unknown";
    notifyError(ZALO_LOGIN_ERROR_MESSAGES[reason] || ZALO_LOGIN_ERROR_MESSAGES.unknown);
  }, [searchParams]);

  async function onSubmit(values) {
    try {
      const user = await login(values).unwrap();
      notifySuccess("Đăng nhập thành công");
      // Từ cổng admin (không có session / cookie domain) → về thẳng dashboard admin.
      if (isSuperadminUser(user) && searchParams.get("portal") === "admin") {
        window.location.assign(`${getSuperadminAppOrigin()}/dashboard`);
        return;
      }
      const next = resolvePostLoginPath(user, searchParams.get("from"), {
        supplierOrigin: getSupplierAppOrigin(),
      });
      navigateAfterLogin(next, {
        assign: window.location.assign.bind(window.location),
        replace: router.replace.bind(router),
      });
    } catch (error) {
      notifyError(error?.data?.message || "Đăng nhập thất bại.");
    }
  }

  async function handleGoogleLogin() {
    setIsGoogleBusy(true);
    try {
      const params = new URLSearchParams({ from: SUPERADMIN_PORTAL_CHOOSER_PATH });
      const res = await fetch(`${apiBase}/auth/google/login/authorize-url?${params}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError(body?.message || "Không bắt đầu được đăng nhập Google.");
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
      setIsGoogleBusy(false);
    }
  }

  async function handleZaloLogin() {
    setIsZaloBusy(true);
    try {
      const portal = window.location.origin === getSupplierAppOrigin() ? "supplier" : "main";
      const from = safeInternalPath(searchParams.get("from"));
      const params = new URLSearchParams({ portal, mode: "login", from });
      const res = await fetch(`${apiBase}/auth/zalo/login/authorize-url?${params}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError(body?.message || "Không bắt đầu được đăng nhập Zalo.");
        return;
      }
      const url = body?.data?.url;
      if (typeof url !== "string" || !url.startsWith("https://")) {
        notifyError("Máy chủ không trả về URL Zalo hợp lệ.");
        return;
      }
      window.location.assign(url);
    } catch {
      notifyError("Lỗi mạng. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setIsZaloBusy(false);
    }
  }

  const isBusy = isLoading || isGoogleBusy || isZaloBusy;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Đăng nhập vào hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Sử dụng tên đăng nhập hoặc email cùng với mật khẩu, hoặc đăng nhập
          bằng Google nếu email đã đăng ký trong hệ thống.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        disabled={isBusy}
        onClick={handleGoogleLogin}
        title="Đăng nhập bằng Google"
      >
        {isGoogleBusy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <GoogleIcon className="size-4 shrink-0" />
        )}
        <span>{isGoogleBusy ? "Đang chuyển tới Google…" : "Đăng nhập bằng Google"}</span>
      </Button>

      {showZaloLogin ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          disabled={isBusy}
          onClick={handleZaloLogin}
          title="Đăng nhập bằng Zalo"
        >
          {isZaloBusy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ZaloIcon className="size-4 shrink-0" />
          )}
          <span>{isZaloBusy ? "Đang chuyển tới Zalo…" : "Đăng nhập bằng Zalo"}</span>
        </Button>
      ) : null}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="px-2 bg-background text-muted-foreground">hoặc</span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block space-y-2" htmlFor="ql-login-identifier">
          <span className="text-sm font-medium">Username hoặc email</span>
          <input
            type="text"
            autoComplete="username"
            className="w-full px-4 py-3 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary aria-invalid:border-destructive"
            placeholder="username hoặc email đã đăng ký"
            {...register("identifier")}
            id="ql-login-identifier"
            aria-invalid={errors.identifier ? "true" : undefined}
            aria-describedby={errors.identifier ? "ql-login-identifier-error" : undefined}
          />
          {errors.identifier ? (
            <p id="ql-login-identifier-error" role="alert" className="text-sm text-destructive">
              {errors.identifier.message}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2" htmlFor="ql-login-password">
          <span className="text-sm font-medium">Mật khẩu</span>
          <div className="relative">
            <input
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-12 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary aria-invalid:border-destructive"
              placeholder="Nhập mật khẩu"
              {...register("password")}
              id="ql-login-password"
              aria-invalid={errors.password ? "true" : undefined}
              aria-describedby={errors.password ? "ql-login-password-error" : undefined}
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
            <p id="ql-login-password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
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
          disabled={isBusy}
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
