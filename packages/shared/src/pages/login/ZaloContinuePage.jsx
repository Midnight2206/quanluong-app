"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { qk } from "@/app/query/queryKeys";
import { Button } from "@/components/ui/Button";
import { useGetRegisterUnitsQuery } from "@/features/auth/api/authApi";
import { mapPermissionsFromUser, useAuthStore } from "@/features/auth/model/authStore";
import { notifyError } from "@/services/notify";
import { clearTargetUnitId } from "@/services/targetUnitScope";
import { getApiBaseUrl } from "@/utils/runtimeEnv";
import { navigateAfterLogin, resolvePostLoginPath } from "@/utils/postLoginPath";
import { getSupplierAppOrigin } from "@/utils/supplierPortal";

const PENDING_MESSAGE = "Tài khoản đang chờ duyệt. Liên hệ quản trị đơn vị của bạn.";

const ZALO_ATTEMPT_ERRORS = {
  no_phone: "Zalo không trả về số điện thoại.",
  id_mismatch: "Tài khoản Zalo không khớp phiếu này.",
  expired: "Phiếu xác minh đã hết hạn.",
  ambiguous: "Số điện thoại trùng nhiều tài khoản.",
  superadmin: "Không đăng nhập superadmin bằng Zalo.",
  taken: "Mã Zalo đã thuộc tài khoản khác.",
};

const fieldClass =
  "w-full px-4 py-3 text-sm transition border outline-none rounded-2xl bg-background ring-0 focus:border-primary aria-invalid:border-destructive read-only:bg-muted/40";

function attemptUrl(ticket, suffix = "") {
  return `${getApiBaseUrl()}/auth/zalo/attempts/${encodeURIComponent(ticket)}${suffix}`;
}

function payloadUser(data) {
  if (!data || typeof data !== "object" || data.pending) {
    return null;
  }
  if (data.id != null) {
    return data;
  }
  if (data.user?.id != null) {
    return data.user;
  }
  return null;
}

function zaloScreen(attempt) {
  if (!attempt) {
    return "loading";
  }
  if (attempt.status === "await_phone") {
    return "await_phone";
  }
  if (attempt.status === "failed") {
    return "failed";
  }
  if (attempt.status === "consumed") {
    return "consumed";
  }
  const branch = attempt.branch || attempt.status;
  if (branch === "password" || branch === "link") {
    return "password";
  }
  if (branch === "pending") {
    return "pending";
  }
  if (branch === "register") {
    return "register";
  }
  return "failed";
}

function failedSentence(attempt, loadError) {
  return ZALO_ATTEMPT_ERRORS[attempt?.errorCode] || loadError || "Đăng nhập Zalo thất bại.";
}

function ZaloPhoneOpen({ url }) {
  return (
    <a
      href={url}
      className="inline-flex w-full items-center justify-center rounded-lg border border-primary/20 bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
    >
      Mở app Zalo
    </a>
  );
}

function ZaloPhoneQr({ url }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((mod) => mod.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" }))
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) {
    return <p className="text-sm text-muted-foreground">Đang tạo mã QR…</p>;
  }

  return (
    <img
      src={dataUrl}
      alt="Mã QR mở Zalo để chia sẻ số điện thoại"
      width={220}
      height={220}
      className="mx-auto rounded-2xl bg-white p-3"
    />
  );
}

function PendingBlock() {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold">Chờ duyệt</h1>
      <p className="text-sm text-muted-foreground">{PENDING_MESSAGE}</p>
    </div>
  );
}

function AgainLink() {
  return (
    <Link className="font-medium text-primary" href="/login">
      Quét lại
    </Link>
  );
}

export function ZaloContinuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const ticket = searchParams.get("ticket") || "";
  const [attempt, setAttempt] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [unitId, setUnitId] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function finishLogin(user) {
    if (user) {
      clearTargetUnitId();
      useAuthStore.getState().setAuthState({
        user,
        permissions: mapPermissionsFromUser(user),
      });
      queryClient.invalidateQueries({ queryKey: qk.auth.root });
    }
    const next = resolvePostLoginPath(user, searchParams.get("from"), {
      supplierOrigin: getSupplierAppOrigin(),
    });
    navigateAfterLogin(next, {
      assign: window.location.assign.bind(window.location),
      replace: router.replace.bind(router),
    });
  }

  const finishRef = useRef(finishLogin);
  finishRef.current = finishLogin;

  useEffect(() => {
    if (!ticket) {
      return undefined;
    }
    let cancelled = false;
    let timer = 0;

    async function tick() {
      try {
        const res = await fetch(attemptUrl(ticket), {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setAttempt({
            status: "failed",
            errorCode: res.status === 404 ? "expired" : null,
          });
          setLoadError(body?.message || "Không đọc được phiếu Zalo.");
          return;
        }
        const data = body?.data ?? null;
        if (!data) {
          setLoadError("Không đọc được phiếu Zalo.");
          return;
        }
        setLoadError("");
        if (data.status === "consumed" || payloadUser(data)) {
          finishRef.current(payloadUser(data));
          return;
        }
        if (data.status === "ready" && data.branch === "session") {
          const resumeRes = await fetch(attemptUrl(ticket, "/resume"), {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: "{}",
          });
          const resumeBody = await resumeRes.json().catch(() => ({}));
          if (cancelled) {
            return;
          }
          if (!resumeRes.ok) {
            setAttempt({ status: "failed", errorCode: null });
            setLoadError(resumeBody?.message || "Không vào được tài khoản.");
            return;
          }
          finishRef.current(payloadUser(resumeBody?.data));
          return;
        }
        setAttempt(data);
        if (data.status === "await_phone") {
          timer = window.setTimeout(tick, 2000);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setLoadError("Lỗi mạng. Kiểm tra kết nối rồi thử lại.");
        timer = window.setTimeout(tick, 2000);
      }
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ticket]);

  const screen = zaloScreen(attempt);
  const showUnits = screen === "register" && attempt?.portal !== "supplier";
  const unitsQuery = useGetRegisterUnitsQuery(undefined, { skip: !showUnits });
  const units = unitsQuery.data ?? [];

  async function postAttempt(suffix, body) {
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch(attemptUrl(ticket, suffix), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = payload?.message || "Không hoàn tất được đăng nhập Zalo.";
        setFormError(message);
        notifyError(message);
        return;
      }
      const data = payload?.data ?? null;
      if (data?.pending) {
        setWaitingApproval(true);
        return;
      }
      const user = payloadUser(data);
      if (user || data?.status === "consumed") {
        finishLogin(user);
        return;
      }
      setFormError("Không hoàn tất được đăng nhập Zalo.");
    } catch {
      const message = "Lỗi mạng. Kiểm tra kết nối rồi thử lại.";
      setFormError(message);
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ticket) {
    if (searchParams.get("branch") === "pending") {
      return <PendingBlock />;
    }
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Phiếu không còn hiệu lực</h1>
        <p className="text-sm text-muted-foreground">Không thấy phiếu đăng nhập Zalo.</p>
        <AgainLink />
      </div>
    );
  }

  if (waitingApproval || screen === "pending") {
    return <PendingBlock />;
  }

  if (!attempt) {
    return (
      <p className="text-sm text-muted-foreground">
        {loadError || "Đang kiểm tra phiếu Zalo…"}
      </p>
    );
  }

  if (screen === "await_phone") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Xác minh số điện thoại</h1>
          <p className="text-sm text-muted-foreground lg:hidden">
            Bấm nút bên dưới để mở app Zalo và chia sẻ số điện thoại. Giữ trang này mở, rồi quay lại sau khi xác minh xong.
          </p>
          <p className="hidden text-sm text-muted-foreground lg:block">
            Mở app Zalo trên điện thoại, bấm quét QR và quét mã này để chia sẻ số điện thoại.
            Trang này tự tiếp tục sau khi Zalo xác minh xong.
          </p>
        </div>
        {attempt.miniAppUrl ? (
          <>
            <div className="lg:hidden">
              <ZaloPhoneOpen url={attempt.miniAppUrl} />
            </div>
            <div className="hidden lg:block">
              <ZaloPhoneQr url={attempt.miniAppUrl} />
            </div>
          </>
        ) : (
          <p className="text-sm text-destructive">Chưa có liên kết Mini App.</p>
        )}
        {ticket ? (
          <p className="text-sm text-muted-foreground">
            Mã QR mở bản Testing. Nếu ô phiếu trống, dán phiếu này:
            <span className="mt-2 block break-all font-mono text-foreground">{ticket}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">Đang chờ xác minh…</p>
        {loadError ? (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        ) : null}
      </div>
    );
  }

  if (screen === "failed") {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Không đăng nhập được</h1>
        <p role="alert" className="text-sm text-destructive">
          {failedSentence(attempt, loadError)}
        </p>
        <AgainLink />
      </div>
    );
  }

  if (screen === "password") {
    return (
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!password) {
            setFormError("Nhập mật khẩu tài khoản đã có.");
            return;
          }
          void postAttempt("/link", { password });
        }}
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Xác nhận mật khẩu</h1>
          <p className="text-sm text-muted-foreground">
            Số này đã có tài khoản. Nhập mật khẩu để gắn Zalo.
          </p>
        </div>
        <label className="block space-y-2" htmlFor="ql-zalo-password">
          <span className="text-sm font-medium">Mật khẩu</span>
          <div className="relative">
            <input
              id="ql-zalo-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={`${fieldClass} pr-12`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={formError ? "true" : undefined}
            />
            <button
              type="button"
              className="absolute inset-y-0 inline-flex items-center transition right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <Button className="w-full gap-2" type="submit" disabled={submitting} title="Gắn Zalo">
          {submitting ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
          <span>{submitting ? "Đang xác nhận…" : "Gắn và đăng nhập"}</span>
        </Button>
      </form>
    );
  }

  if (screen === "register") {
    const supplier = attempt.portal === "supplier";
    return (
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const name = username.trim();
          if (name.length < 3 || name.length > 50) {
            setFormError("Tên đăng nhập từ 3 đến 50 ký tự.");
            return;
          }
          const body = { username: name };
          if (!supplier) {
            const id = Number(unitId);
            if (!Number.isInteger(id) || id <= 0) {
              setFormError("Chọn đơn vị.");
              return;
            }
            body.unitId = id;
          }
          void postAttempt("/register", body);
        }}
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Tạo tài khoản</h1>
          <p className="text-sm text-muted-foreground">
            Tên và số lấy từ Zalo. Chọn tên đăng nhập
            {supplier ? "." : " và đơn vị."}
          </p>
        </div>
        <label className="block space-y-2" htmlFor="ql-zalo-name">
          <span className="text-sm font-medium">Tên</span>
          <input
            id="ql-zalo-name"
            className={fieldClass}
            value={attempt.displayName || ""}
            readOnly
            aria-readonly="true"
          />
        </label>
        <label className="block space-y-2" htmlFor="ql-zalo-phone">
          <span className="text-sm font-medium">Số điện thoại</span>
          <input
            id="ql-zalo-phone"
            className={fieldClass}
            value={attempt.phone || ""}
            readOnly
            aria-readonly="true"
          />
        </label>
        <label className="block space-y-2" htmlFor="ql-zalo-username">
          <span className="text-sm font-medium">Tên đăng nhập</span>
          <input
            id="ql-zalo-username"
            type="text"
            autoComplete="username"
            className={fieldClass}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-invalid={formError ? "true" : undefined}
          />
        </label>
        {showUnits ? (
          <label className="block space-y-2" htmlFor="ql-zalo-unit">
            <span className="text-sm font-medium">Đơn vị</span>
            <select
              id="ql-zalo-unit"
              className={fieldClass}
              value={unitId}
              disabled={unitsQuery.isLoading || !units.length}
              onChange={(event) => setUnitId(event.target.value)}
            >
              <option value="">
                {unitsQuery.isLoading ? "Đang tải đơn vị..." : "Chọn đơn vị"}
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {!unitsQuery.isLoading && !units.length ? (
              <p className="text-xs text-muted-foreground">
                {unitsQuery.isError
                  ? "Không tải được danh sách đơn vị."
                  : "Hiện chưa có đơn vị khả dụng để đăng ký."}
              </p>
            ) : null}
          </label>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <Button className="w-full gap-2" type="submit" disabled={submitting} title="Đăng ký bằng Zalo">
          {submitting ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
          <span>{submitting ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</span>
        </Button>
      </form>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">Đang đăng nhập…</p>
  );
}
