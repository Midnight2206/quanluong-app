"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Contact,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { qk } from "@/app/query/queryKeys";
import {
  useChangePasswordMutation,
  useDeleteAvatarMutation,
  useLogoutMutation,
  usePatchMeProfileMutation,
  useUploadAvatarMutation,
} from "@/features/auth/api/authApi";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { apiRequest } from "@/services/apiRequest";
import { changePasswordSchema, meProfileFormSchema } from "@/features/auth/schemas/authSchemas";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { resolveMediaUrl } from "@/utils/runtimeEnv";

const cardBody = "space-y-2 !p-3 sm:!p-4";

function formatDateForInput(iso) {
  if (!iso) return "";
  return typeof iso === "string" ? iso.slice(0, 10) : "";
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

async function waitForAvatarJob(queryClient, jobId) {
  const maxAttempts = 90;
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await queryClient.fetchQuery({
      queryKey: qk.auth.avatarJob(jobId),
      queryFn: () => apiRequest({ url: `/auth/me/avatar-job/${jobId}`, method: "get" }),
    });

    if (status?.status === "unavailable") {
      throw new Error(
        status.message || "Không tra cứu được job (Redis/queue). Chạy API đồng bộ hoặc bật worker-media.",
      );
    }

    if (status?.status === "completed") {
      await queryClient.invalidateQueries({ queryKey: qk.auth.currentUser() });
      return;
    }
    if (status?.status === "failed") {
      throw new Error(status.error || "Xử lý ảnh thất bại.");
    }
  }
  throw new Error("Hết thời gian chờ xử lý ảnh. Kiểm tra worker-media và Redis.");
}

const fieldClass =
  "w-full rounded-2xl border border-border bg-background py-3 px-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20";

function formatLockoutRemaining(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r} giây`;
  if (r === 0) return `${m} phút`;
  return `${m} phút ${r} giây`;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useCurrentUser();
  const avatarUrl = user?.profile?.avatarUrl;
  const avatarDisplaySrc = avatarUrl ? resolveMediaUrl(avatarUrl) : null;
  const displayEmail = user?.email ?? "";

  const [showCrop, setShowCrop] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const filePickRef = useRef(null);

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [pwdLockoutUntil, setPwdLockoutUntil] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [patchProfile, { isLoading: savingProfile }] = usePatchMeProfileMutation();
  const [uploadAvatar, { isLoading: uploading }] = useUploadAvatarMutation();
  const [deleteAvatar, { isLoading: deleting }] = useDeleteAvatarMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const profileForm = useForm({
    resolver: zodResolver(meProfileFormSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      address: "",
      description: "",
      jobTitle: "",
      rank: "",
      birthday: "",
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = profileForm;

  const {
    register: regPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = passwordForm;

  useEffect(() => {
    if (pwdLockoutUntil == null) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNowTick(t);
      if (t >= pwdLockoutUntil) {
        setPwdLockoutUntil(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pwdLockoutUntil]);

  useEffect(() => {
    if (!user?.profile && !user?.username) return;
    resetProfile({
      fullName: user.profile?.fullName || user.username || "",
      phoneNumber: user.profile?.phoneNumber || "",
      address: user.profile?.address || "",
      description: user.profile?.description || "",
      jobTitle: user.profile?.jobTitle || "",
      rank: user.profile?.rank || "",
      birthday: formatDateForInput(user.profile?.birthday),
    });
  }, [user, resetProfile]);

  useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function closeCropModal() {
    setShowCrop(false);
    if (imageSrc) {
      URL.revokeObjectURL(imageSrc);
    }
    setImageSrc(null);
    setPendingFile(null);
    setCroppedAreaPixels(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (imageSrc) {
      URL.revokeObjectURL(imageSrc);
    }
    setPendingFile(file);
    setImageSrc(URL.createObjectURL(file));
    setShowCrop(true);
    setCroppedAreaPixels(null);
  }

  async function confirmCropAndUpload() {
    if (!pendingFile || !croppedAreaPixels) {
      notifyError("Hãy chỉnh khung crop trước khi lưu.");
      return;
    }
    try {
      const result = await uploadAvatar({
        file: pendingFile,
        crop: croppedAreaPixels,
      }).unwrap();

      if (result?.jobId) {
        notifySuccess("Đã nhận ảnh, đang xử lý trong nền…");
        await waitForAvatarJob(queryClient, result.jobId);
        notifySuccess("Đã cập nhật ảnh đại diện.");
      } else {
        notifySuccess("Đã cập nhật ảnh đại diện.");
      }
      closeCropModal();
    } catch (error) {
      notifyError(error?.data?.message || error?.message || "Không tải được ảnh.");
    }
  }

  async function onDeleteAvatar() {
    if (!avatarUrl) return;
    if (!window.confirm("Xóa ảnh đại diện hiện tại?")) return;
    try {
      await deleteAvatar().unwrap();
      notifySuccess("Đã xóa ảnh đại diện.");
    } catch (error) {
      notifyError(error?.data?.message || "Không xóa được ảnh.");
    }
  }

  async function onSaveProfile(values) {
    try {
      await patchProfile({
        fullName: values.fullName,
        phoneNumber: values.phoneNumber?.trim() || null,
        address: values.address?.trim() || null,
        description: values.description?.trim() || null,
        jobTitle: values.jobTitle?.trim() || null,
        rank: values.rank?.trim() || null,
        birthday: values.birthday ? values.birthday : null,
      }).unwrap();
      notifySuccess("Đã lưu hồ sơ.");
    } catch (error) {
      notifyError(error?.data?.message || "Không lưu được hồ sơ.");
    }
  }

  async function onChangePassword(values) {
    try {
      const res = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      }).unwrap();
      setPwdLockoutUntil(null);
      notifySuccess(res?.message || "Đã đổi mật khẩu.");
      resetPwd();
      try {
        await logout().unwrap();
      } catch {
        /* vẫn chuyển login */
      }
      router.replace("/login");
    } catch (error) {
      const status = error?.status;
      const data = error?.data;
      const msg = data?.message || "Không đổi được mật khẩu.";
      notifyError(msg);
      if (status === 429) {
        const fromBody = data?.error?.details?.retryAfterSec;
        const fromHdr = error?.retryAfterSec;
        const secRaw = fromBody ?? fromHdr;
        const sec = typeof secRaw === "number" ? secRaw : Number.parseInt(String(secRaw ?? ""), 10);
        if (Number.isFinite(sec) && sec > 0) {
          setPwdLockoutUntil(Date.now() + sec * 1000);
          setNowTick(Date.now());
        }
      }
    }
  }

  const busyMedia = uploading || deleting;
  const busyPassword = changingPassword || isLoggingOut;
  const pwdLocked = pwdLockoutUntil != null && nowTick < pwdLockoutUntil;
  const pwdLockoutRemainingSec =
    pwdLockoutUntil != null ? Math.max(0, Math.ceil((pwdLockoutUntil - nowTick) / 1000)) : 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header
        data-sticky-level="0"
        className="unified-sticky-surface mb-6 border-b border-border/80 pb-5"
      >
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Trang cá nhân</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cập nhật ảnh đại diện, thông tin liên hệ và mật khẩu. Ảnh đại diện được xử lý qua hàng đợi khi có
          Redis và worker-media.
        </p>
        {displayEmail ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Đăng nhập: <span className="font-medium text-foreground">{displayEmail}</span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4">
          <Card className="border-border/80 shadow-soft">
            <CardContent className={cn(cardBody, "pt-5")}>
              <SectionHeader icon={UserRound} title="Ảnh đại diện" />
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start lg:flex-col lg:items-center">
                <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
                  {avatarDisplaySrc ? (
                    <img src={avatarDisplaySrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="size-16 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="flex w-full flex-col gap-2 text-center sm:text-left lg:text-center">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Vuông, tối đa 2&nbsp;MB (JPEG/PNG/WebP/GIF). Server tạo WebP tối đa 512px.
                  </p>
                  <input
                    ref={filePickRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={onPickFile}
                  />
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start lg:justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-2xl"
                      disabled={busyMedia}
                      onClick={() => filePickRef.current?.click()}
                    >
                      {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      <span className={cn(uploading && "ml-2")}>Chọn & crop</span>
                    </Button>
                    {avatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-2xl text-destructive hover:text-destructive"
                        disabled={busyMedia}
                        onClick={onDeleteAvatar}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="ml-2">Xóa</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-8">
          <Card className="border-border/80 shadow-soft">
            <CardContent className={cn(cardBody, "pt-5")}>
              <SectionHeader icon={Contact} title="Thông tin liên hệ" />
              <form className="space-y-4" onSubmit={handleProfileSubmit(onSaveProfile)} noValidate>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Họ và tên</span>
                  <input className={fieldClass} {...regProfile("fullName")} />
                  {profileErrors.fullName ? (
                    <p className="text-sm text-destructive">{profileErrors.fullName.message}</p>
                  ) : null}
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Số điện thoại</span>
                  <input className={fieldClass} {...regProfile("phoneNumber")} />
                  {profileErrors.phoneNumber ? (
                    <p className="text-sm text-destructive">{profileErrors.phoneNumber.message}</p>
                  ) : null}
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Địa chỉ</span>
                  <textarea rows={2} className={cn(fieldClass, "resize-y min-h-[4.5rem]")} {...regProfile("address")} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Mô tả ngắn</span>
                  <textarea
                    rows={2}
                    className={cn(fieldClass, "resize-y min-h-[4.5rem]")}
                    {...regProfile("description")}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Chức danh (text)</span>
                    <input className={fieldClass} {...regProfile("jobTitle")} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Cấp bậc / hàm</span>
                    <input className={fieldClass} {...regProfile("rank")} />
                  </label>
                </div>
                <label className="block space-y-2 sm:max-w-xs">
                  <span className="text-sm font-medium">Ngày sinh</span>
                  <input type="date" className={fieldClass} {...regProfile("birthday")} />
                </label>
                <Button type="submit" className="rounded-2xl" disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  <span className={cn(savingProfile && "ml-2")}>Lưu hồ sơ</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-soft" id="doi-mat-khau">
            <CardContent className={cn(cardBody, "pt-5")}>
              <SectionHeader icon={Shield} title="Đổi mật khẩu" />
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Sau khi đổi mật khẩu thành công, bạn sẽ đăng xuất và đăng nhập lại. Các phiên khác sẽ bị hủy;
                nếu đã cấu hình email, hệ thống có thể gửi thông báo. Nhập sai mật khẩu hiện tại quá 5 lần trong
                15 phút sẽ bị khóa đổi mật khẩu tạm thời (máy chủ dùng Redis để đếm).
              </p>
              {pwdLocked ? (
                <div
                  className="mb-4 flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100"
                  role="status"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">Đang tạm khóa đổi mật khẩu</p>
                    <p className="mt-1 text-xs opacity-90">
                      Thử lại sau{" "}
                      <span className="font-semibold tabular-nums">
                        {formatLockoutRemaining(pwdLockoutRemainingSec)}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              ) : null}
              <form className="space-y-4" onSubmit={handlePwdSubmit(onChangePassword)} noValidate>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Mật khẩu hiện tại</span>
                  <div className="relative">
                    <input
                      type={showCur ? "text" : "password"}
                      autoComplete="current-password"
                      disabled={pwdLocked}
                      className={cn(fieldClass, "pr-12", pwdLocked && "cursor-not-allowed opacity-60")}
                      {...regPwd("currentPassword")}
                    />
                    <button
                      type="button"
                      disabled={pwdLocked}
                      className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => setShowCur((v) => !v)}
                      aria-label={showCur ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showCur ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {pwdErrors.currentPassword ? (
                    <p className="text-sm text-destructive">{pwdErrors.currentPassword.message}</p>
                  ) : null}
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Mật khẩu mới</span>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      disabled={pwdLocked}
                      className={cn(fieldClass, "pr-12", pwdLocked && "cursor-not-allowed opacity-60")}
                      {...regPwd("newPassword")}
                    />
                    <button
                      type="button"
                      disabled={pwdLocked}
                      className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => setShowNew((v) => !v)}
                      aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {pwdErrors.newPassword ? (
                    <p className="text-sm text-destructive">{pwdErrors.newPassword.message}</p>
                  ) : null}
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Xác nhận mật khẩu mới</span>
                  <div className="relative">
                    <input
                      type={showConf ? "text" : "password"}
                      autoComplete="new-password"
                      disabled={pwdLocked}
                      className={cn(fieldClass, "pr-12", pwdLocked && "cursor-not-allowed opacity-60")}
                      {...regPwd("confirmNewPassword")}
                    />
                    <button
                      type="button"
                      disabled={pwdLocked}
                      className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => setShowConf((v) => !v)}
                      aria-label={showConf ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showConf ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {pwdErrors.confirmNewPassword ? (
                    <p className="text-sm text-destructive">{pwdErrors.confirmNewPassword.message}</p>
                  ) : null}
                </label>
                <Button type="submit" className="gap-2 rounded-2xl" disabled={busyPassword || pwdLocked}>
                  {busyPassword ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>{busyPassword ? "Đang xử lý…" : "Lưu mật khẩu & đăng nhập lại"}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {showCrop && imageSrc ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-4 shadow-float">
            <h3 id="crop-title" className="mb-3 text-base font-semibold">
              Crop ảnh đại diện
            </h3>
            <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Thu phóng</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-2xl" onClick={closeCropModal}>
                Hủy
              </Button>
              <Button type="button" className="rounded-2xl" onClick={confirmCropAndUpload} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={cn(uploading && "ml-2")}>Tải lên</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
