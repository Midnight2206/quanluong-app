"use client";

import { Cloud, ExternalLink } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useCheckGoogleDriveLinkMutation,
  useLazyGetCurrentUserQuery,
  useUnlinkGoogleDriveMutation,
} from "@/features/auth/api/authApi";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { getApiBaseUrl } from "@/utils/runtimeEnv";
import { HomeLanding } from "./HomeLanding.jsx";
import {
  applyLandingDocumentLocale,
  getLandingCopy,
  readExplicitStoredLandingLocale,
  resolveLandingLocale,
  writeLandingLocale,
} from "./landingCopy.js";

/**
 * @param {{ initialLocale?: string }} props
 */
export function HomePage({ initialLocale = "vi" }) {
  const user = useCurrentUser();
  const isAuthenticated = useIsAuthenticated();
  const displayName = user?.profile?.fullName || user?.username;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const googleParam = searchParams.get("google");
  const googleReasonParam = searchParams.get("reason");
  const googleMsgParam = searchParams.get("msg");
  const [refetchUser] = useLazyGetCurrentUserQuery();
  const [unlinkDrive, { isLoading: unlinkingDrive }] = useUnlinkGoogleDriveMutation();
  const [checkDriveLink] = useCheckGoogleDriveLinkMutation();
  const checkedDriveFolderRef = useRef(null);
  const handledGoogleResultRef = useRef(null);
  const localeSyncRef = useRef(false);
  const localeRef = useRef(resolveLandingLocale(initialLocale));
  const { confirm } = useConfirm();
  const [driveLinkBusy, setDriveLinkBusy] = useState(false);
  const [locale, setLocale] = useState(() => resolveLandingLocale(initialLocale));
  const apiBase = getApiBaseUrl();
  const copy = getLandingCopy(locale);
  localeRef.current = locale;

  useEffect(() => {
    setLocale(resolveLandingLocale(initialLocale));
  }, [initialLocale]);

  useEffect(() => {
    applyLandingDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      document.documentElement.lang = "vi";
    };
  }, []);

  useEffect(() => {
    if (localeSyncRef.current) return;
    localeSyncRef.current = true;
    const stored = readExplicitStoredLandingLocale();
    if (stored == null) {
      writeLandingLocale(initialLocale);
      return;
    }
    if (stored !== resolveLandingLocale(initialLocale)) {
      writeLandingLocale(stored);
      setLocale(stored);
      router.refresh();
    }
  }, [initialLocale, router]);

  useEffect(() => {
    const g = googleParam;
    const reason = googleReasonParam;
    const resultKey = `${g || ""}:${reason || ""}:${googleMsgParam || ""}`;
    if ((g === "linked" || g === "error") && handledGoogleResultRef.current === resultKey) {
      return;
    }
    const text = getLandingCopy(localeRef.current);
    if (g === "linked") {
      handledGoogleResultRef.current = resultKey;
      notifySuccess(text.drive.linkedToast);
      void refetchUser();
      const next = new URLSearchParams(searchParams.toString());
      next.delete("google");
      next.delete("reason");
      next.delete("msg");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    } else if (g === "error") {
      handledGoogleResultRef.current = resultKey;
      const msg =
        (googleMsgParam && googleMsgParam.trim()) ||
        (reason && text.driveErrors[reason]) ||
        text.driveErrors.unknown;
      notifyError(msg);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("google");
      next.delete("reason");
      next.delete("msg");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams thay đổi mỗi render; chỉ cần scalar google* + pathname + router.
  }, [googleParam, googleReasonParam, googleMsgParam, pathname, refetchUser, router]);

  useEffect(() => {
    const folderId = user?.googleDriveFolderId;
    if (!folderId || checkedDriveFolderRef.current === folderId) {
      return;
    }
    checkedDriveFolderRef.current = folderId;
    let cancelled = false;
    async function checkLinkedFolder() {
      try {
        const nextUser = await checkDriveLink().unwrap();
        if (!cancelled && !nextUser?.googleDriveFolderId) {
          notifyError(getLandingCopy(localeRef.current).drive.folderMissing);
        }
      } catch {
        // Không chặn trang chủ nếu Google tạm thời không phản hồi.
      }
    }
    void checkLinkedFolder();
    return () => {
      cancelled = true;
    };
  }, [checkDriveLink, user?.googleDriveFolderId]);

  const canLinkDrive = isAuthenticated;

  const mayUseDriveLink = Boolean(
    user?.emailVerified || user?.type?.name === "superadmin",
  );

  const driveFolderUrl = useMemo(() => {
    const id = user?.googleDriveFolderId;
    if (!id) {
      return null;
    }
    return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
  }, [user?.googleDriveFolderId]);

  function changeLocale(next) {
    const resolved = writeLandingLocale(next);
    if (resolved === locale) return;
    setLocale(resolved);
    applyLandingDocumentLocale(resolved);
    router.refresh();
  }

  async function startGoogleDriveLink() {
    const text = getLandingCopy(locale);
    setDriveLinkBusy(true);
    try {
      const res = await fetch(`${apiBase}/auth/google/drive/authorize-url`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        notifyError(body?.message || text.drive.sessionFallback);
        return;
      }
      if (!res.ok) {
        notifyError(body?.message || text.drive.startFail);
        return;
      }
      const url = body?.data?.url;
      if (typeof url !== "string" || !url.startsWith("https://")) {
        notifyError(text.drive.badUrl);
        return;
      }
      window.location.assign(url);
    } catch {
      notifyError(text.drive.network);
    } finally {
      setDriveLinkBusy(false);
    }
  }

  async function handleUnlinkDrive() {
    const text = getLandingCopy(locale);
    const ok = await confirm({
      title: text.drive.unlinkTitle,
      message: text.drive.unlinkMessage,
      confirmLabel: text.drive.unlinkConfirm,
    });
    if (!ok) {
      return;
    }
    try {
      await unlinkDrive().unwrap();
      notifySuccess(text.drive.unlinkedToast);
    } catch (e) {
      notifyError(e?.data?.message || text.drive.unlinkFail);
    }
  }

  const driveSlot = canLinkDrive ? (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Cloud className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">{copy.drive.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.drive.body}</p>
            {user?.googleDriveFolderId ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{copy.drive.linked}</span> {copy.drive.folderId}:{" "}
                <span className="break-all font-mono">{user.googleDriveFolderId}</span>
              </p>
            ) : !mayUseDriveLink ? (
              <p className="text-sm text-warning">{copy.drive.unverified}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {mayUseDriveLink && user?.googleDriveFolderId && driveFolderUrl ? (
            <>
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow-soft transition-colors duration-150 hover:bg-primary/90 max-lg:min-h-11",
                )}
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                {copy.drive.open}
              </a>
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-muted-foreground hover:text-destructive max-lg:min-h-11 sm:self-end"
                disabled={unlinkingDrive}
                onClick={() => void handleUnlinkDrive()}
              >
                {unlinkingDrive ? copy.drive.unlinking : copy.drive.unlink}
              </Button>
            </>
          ) : null}
          {mayUseDriveLink && !user?.googleDriveFolderId ? (
            <button
              type="button"
              disabled={driveLinkBusy}
              onClick={() => void startGoogleDriveLink()}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground shadow-soft transition-colors duration-150 hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 max-lg:min-h-11",
              )}
            >
              {driveLinkBusy ? copy.drive.linking : copy.drive.link}
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <HomeLanding
      copy={copy}
      locale={locale}
      onLocaleChange={changeLocale}
      isAuthenticated={isAuthenticated}
      displayName={displayName}
      driveSlot={driveSlot}
    />
  );
}
