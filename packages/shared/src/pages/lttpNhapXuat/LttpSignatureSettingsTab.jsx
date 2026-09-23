"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  useGetLttpIssueSlipApproverAdminsQuery,
  useGetLttpIssueSlipSignatureSettingsQuery,
  usePutLttpIssueSlipSignatureSettingsMutation,
} from "@/features/lttp/api/lttpApi";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const lockedInputClass =
  "w-full cursor-not-allowed rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground";

const LOCKED_SLOT_KEYS = new Set(["nguoi_viet_phieu", "nguoi_nhan"]);

const DEFAULT_SLOTS = [
  {
    key: "nguoi_viet_phieu",
    label: "NGƯỜI VIẾT PHIẾU",
    col: 0,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    catalogNodeId: "",
    locked: true,
    show_date_line: false,
    approverUserId: null,
    approverIsSelf: false,
    useDigitalSignature: true,
  },
  {
    key: "thu_kho",
    label: "THỦ KHO",
    col: 1,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    catalogNodeId: "",
    locked: false,
    show_date_line: false,
    approverUserId: null,
    approverIsSelf: false,
    useDigitalSignature: true,
  },
  {
    key: "nguoi_nhan",
    label: "NGƯỜI NHẬN",
    col: 2,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    catalogNodeId: "",
    locked: true,
    show_date_line: false,
    approverUserId: null,
    approverIsSelf: false,
    useDigitalSignature: true,
  },
  {
    key: "nguoi_duyet",
    label: "NGƯỜI DUYỆT",
    col: 3,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    catalogNodeId: "",
    locked: false,
    show_date_line: false,
    approverUserId: null,
    approverIsSelf: false,
    useDigitalSignature: true,
  },
];

function lockedSlotHint(key) {
  if (key === "nguoi_viet_phieu") {
    return "Cố định: tên lấy từ user đang làm việc — không sửa tại đây.";
  }
  if (key === "nguoi_nhan") {
    return "Cố định: tên lấy từ người nhận đã chọn trên phiếu — không sửa tại đây.";
  }
  return "";
}

function defaultFormValues() {
  return {
    signatureBlock: {
      columns: 4,
      gap_pt: 40,
      date_line_gap_pt: 4,
      slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    },
    extraFields: { lyDoSuDung: "", nhanTaiKho: "" },
  };
}

function formFromServer(data, defaults) {
  if (!data) {
    return defaults;
  }
  const block = data.signatureBlock?.slots?.length
    ? data.signatureBlock
    : defaults.signatureBlock;
  return {
    signatureBlock: {
      columns: Number(block.columns) || 4,
      gap_pt: (() => {
        const raw = Number(block.gap_pt);
        return Number.isFinite(raw) && raw >= 20 ? raw : 40;
      })(),
      date_line_gap_pt: Number(block.date_line_gap_pt) || 4,
      slots: (block.slots ?? defaults.signatureBlock.slots).map((s, i) => {
        const base = DEFAULT_SLOTS[i % DEFAULT_SLOTS.length];
        const key = s.key || base.key;
        const locked = LOCKED_SLOT_KEYS.has(key) || Boolean(s.locked) || base.locked;
        const isApprover = key === "nguoi_duyet";
        return {
          ...base,
          ...s,
          key,
          locked,
          source: locked
            ? "dynamic"
            : isApprover && s.approverUserId
              ? "dynamic"
              : isApprover
                ? s.source || "dynamic"
                : s.source || base.source,
          static_name: locked ? "" : s.static_name ?? "",
          approverUserId: isApprover
            ? s.approverUserId != null && s.approverUserId !== ""
              ? Number(s.approverUserId)
              : null
            : null,
          approverIsSelf: isApprover ? Boolean(s.approverIsSelf) : false,
          useDigitalSignature: isApprover ? s.useDigitalSignature !== false : true,
        };
      }),
    },
    extraFields: {
      lyDoSuDung: data.extraFields?.lyDoSuDung ?? "",
      nhanTaiKho: data.extraFields?.nhanTaiKho ?? "",
    },
  };
}

function formatUserLabel(u) {
  if (!u) return "";
  const name = String(u.displayName || u.fullName || u.username || "").trim();
  const sig = u.hasSignature ? " · có chữ ký số" : " · chưa có chữ ký số";
  return `${name}${sig}`;
}

/**
 * Cài đặt chữ ký phiếu xuất LTTP theo đơn vị kho.
 * @param {{ unitId: number, canWrite?: boolean, canEditApprover?: boolean }} props
 */
export function LttpSignatureSettingsTab({
  unitId,
  canWrite = false,
  canEditApprover = false,
}) {
  const currentUser = useCurrentUser();
  const { data, isLoading, isFetching } = useGetLttpIssueSlipSignatureSettingsQuery(unitId, {
    skip: unitId == null,
  });
  const { data: adminCandidates = [], isLoading: loadingAdmins } =
    useGetLttpIssueSlipApproverAdminsQuery(unitId, { skip: unitId == null });
  const [saveSettings, { isLoading: saving }] =
    usePutLttpIssueSlipSignatureSettingsMutation();

  const {
    draft: sigDraft,
    setDraftPayload: persistSigDraft,
    clear: clearSigDraft,
    ready: sigPersistReady,
  } = useDraftPersist({
    draftType: "issue-slip-signature",
    unitId,
    enabled: unitId != null,
  });

  const defaults = useMemo(() => defaultFormValues(), []);
  const { register, control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: defaults,
  });
  const { fields } = useFieldArray({ control, name: "signatureBlock.slots" });

  const hydrateKey = useRef(null);
  const persistAllowedRef = useRef(false);
  const usedLocalDraftRef = useRef(false);

  const editApprover = Boolean(canWrite && canEditApprover);

  useLayoutEffect(() => {
    persistAllowedRef.current = false;
    usedLocalDraftRef.current = false;
    if (unitId == null || !sigPersistReady) {
      return;
    }
    const k = String(unitId);
    if (hydrateKey.current === k) {
      return;
    }
    hydrateKey.current = k;

    if (sigDraft?.signatureBlock && sigDraft?.extraFields) {
      reset({
        signatureBlock: sigDraft.signatureBlock,
        extraFields: sigDraft.extraFields,
      });
      usedLocalDraftRef.current = true;
      persistAllowedRef.current = true;
      return;
    }
  }, [unitId, sigPersistReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (unitId == null || !sigPersistReady) {
      return;
    }
    if (usedLocalDraftRef.current) {
      return;
    }
    if (hydrateKey.current !== String(unitId)) {
      return;
    }
    if (!data && isLoading) {
      return;
    }
    reset(formFromServer(data, defaults));
    persistAllowedRef.current = true;
  }, [data, defaults, reset, unitId, sigPersistReady, isLoading]);

  useEffect(() => {
    if (!persistAllowedRef.current || !sigPersistReady || unitId == null || !canWrite) {
      return undefined;
    }
    const sub = watch((values) => {
      persistSigDraft({
        signatureBlock: values.signatureBlock,
        extraFields: values.extraFields,
      });
    });
    return () => sub.unsubscribe();
  }, [watch, persistSigDraft, sigPersistReady, unitId, canWrite]);

  const onSubmit = async (values) => {
    if (unitId == null) return;
    try {
      await saveSettings({
        unitId,
        signatureBlock: {
          ...values.signatureBlock,
          slots: (values.signatureBlock?.slots ?? []).map((s) => {
            const locked = LOCKED_SLOT_KEYS.has(s.key) || Boolean(s.locked);
            if (locked) {
              return { ...s, locked: true, source: "dynamic", static_name: "" };
            }
            if (s.key === "nguoi_duyet") {
              const uid =
                s.approverUserId != null && s.approverUserId !== ""
                  ? Number(s.approverUserId)
                  : null;
              const linked = Number.isInteger(uid) && uid > 0;
              return {
                ...s,
                // Linked → dynamic (user-resolved); unlinked → static text nếu có.
                source: linked ? "dynamic" : String(s.static_name ?? "").trim() ? "static" : "dynamic",
                approverUserId: linked ? uid : null,
                approverIsSelf: Boolean(s.approverIsSelf),
                useDigitalSignature: s.useDigitalSignature !== false,
                static_name: String(s.static_name ?? "").trim(),
              };
            }
            return s;
          }),
        },
        extraFields: values.extraFields,
      });
      await clearSigDraft();
      usedLocalDraftRef.current = false;
      notifySuccess("Đã lưu cài đặt chữ ký.");
    } catch (e) {
      notifyError(e?.data?.message || e?.message || "Không lưu được cài đặt chữ ký.");
    }
  };

  function applyApproverSelection(index, value) {
    if (value === "__self__") {
      const me = currentUser;
      const display = [me?.profile?.rankFull, me?.profile?.fullName || me?.username]
        .filter(Boolean)
        .join(" ")
        .trim();
      setValue(`signatureBlock.slots.${index}.approverIsSelf`, true, { shouldDirty: true });
      setValue(`signatureBlock.slots.${index}.approverUserId`, me?.id ?? null, {
        shouldDirty: true,
      });
      setValue(`signatureBlock.slots.${index}.static_name`, display, { shouldDirty: true });
      setValue(`signatureBlock.slots.${index}.source`, "dynamic", { shouldDirty: true });
      return;
    }
    if (value === "" || value == null) {
      setValue(`signatureBlock.slots.${index}.approverIsSelf`, false, { shouldDirty: true });
      setValue(`signatureBlock.slots.${index}.approverUserId`, null, { shouldDirty: true });
      setValue(`signatureBlock.slots.${index}.static_name`, "", { shouldDirty: true });
      setValue(`signatureBlock.slots.${index}.source`, "dynamic", { shouldDirty: true });
      return;
    }
    const id = Number(value);
    const found = (Array.isArray(adminCandidates) ? adminCandidates : []).find(
      (a) => Number(a.id) === id,
    );
    setValue(`signatureBlock.slots.${index}.approverIsSelf`, false, { shouldDirty: true });
    setValue(`signatureBlock.slots.${index}.approverUserId`, id, { shouldDirty: true });
    setValue(
      `signatureBlock.slots.${index}.static_name`,
      found?.displayName || found?.fullName || found?.username || "",
      { shouldDirty: true },
    );
    setValue(`signatureBlock.slots.${index}.source`, "dynamic", { shouldDirty: true });
  }

  if (unitId == null) {
    return <p className="text-xs text-destructive">Chưa có đơn vị kho.</p>;
  }

  const adminsList = Array.isArray(adminCandidates) ? adminCandidates : [];

  return (
    <form data-local-commit-form="true" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <p className="text-xs text-muted-foreground">
        Cấu hình theo đơn vị kho đang chọn.{" "}
        <span className="font-medium text-foreground">Người viết phiếu</span> và{" "}
        <span className="font-medium text-foreground">Người nhận</span> luôn cố định.{" "}
        <span className="font-medium text-foreground">Người duyệt</span> chỉ admin đơn vị được
        chọn (có thể chọn «Bản thân»); người dùng thường chỉ xem.
      </p>

      {!canEditApprover ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100">
          Bạn không phải admin đơn vị — phần người duyệt / chữ ký số ô duyệt ở chế độ chỉ xem.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Lý do sử dụng
          <input
            className={inputClass}
            disabled={!canWrite}
            {...register("extraFields.lyDoSuDung")}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Nhận tại kho
          <input
            className={inputClass}
            disabled={!canWrite}
            {...register("extraFields.nhanTaiKho")}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ô chữ ký (4 thành phần)
        </p>
        <div className="space-y-3">
          {fields.map((field, index) => {
            const source = watch(`signatureBlock.slots.${index}.source`);
            const slotKey = watch(`signatureBlock.slots.${index}.key`);
            const locked = LOCKED_SLOT_KEYS.has(slotKey) || Boolean(field.locked);
            const isApprover = slotKey === "nguoi_duyet";
            const approverUserId = watch(`signatureBlock.slots.${index}.approverUserId`);
            const approverIsSelf = watch(`signatureBlock.slots.${index}.approverIsSelf`);
            const useDigital = watch(`signatureBlock.slots.${index}.useDigitalSignature`);

            if (isApprover) {
              const selectValue = approverIsSelf
                ? "__self__"
                : approverUserId != null && approverUserId !== ""
                  ? String(approverUserId)
                  : "";
              const selectedAdmin = adminsList.find((a) => Number(a.id) === Number(approverUserId));
              return (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-lg border border-border/70 bg-background p-3 sm:grid-cols-2"
                >
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-medium text-foreground">
                      {watch(`signatureBlock.slots.${index}.label`) || "NGƯỜI DUYỆT"}
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary">
                        Admin đơn vị
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Chọn admin làm người duyệt. «Bản thân» lưu đúng userId của bạn (không đổi theo
                      người in sau này). Bật chữ ký số để gắn ảnh PNG đã upload lên PDF.
                    </p>
                  </div>

                  <input type="hidden" {...register(`signatureBlock.slots.${index}.key`)} />
                  <input type="hidden" {...register(`signatureBlock.slots.${index}.source`)} />
                  <input type="hidden" {...register(`signatureBlock.slots.${index}.static_name`)} />
                  <input
                    type="hidden"
                    {...register(`signatureBlock.slots.${index}.approverUserId`, {
                      setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                    })}
                  />
                  <input type="hidden" {...register(`signatureBlock.slots.${index}.approverIsSelf`)} />

                  <label className="text-[10px] text-muted-foreground">
                    Nhãn
                    <input
                      className={cn(!editApprover ? lockedInputClass : inputClass, "mt-0.5")}
                      disabled={!editApprover}
                      {...register(`signatureBlock.slots.${index}.label`)}
                    />
                  </label>

                  <label className="text-[10px] text-muted-foreground">
                    Người duyệt
                    <select
                      className={cn(!editApprover ? lockedInputClass : inputClass, "mt-0.5")}
                      disabled={!editApprover || loadingAdmins}
                      value={selectValue}
                      onChange={(e) => applyApproverSelection(index, e.target.value)}
                    >
                      <option value="">— Chưa chọn —</option>
                      {adminsList.some((a) => Number(a.id) === Number(currentUser?.id)) ? (
                        <option value="__self__">Bản thân (tôi)</option>
                      ) : null}
                      {adminsList.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {formatUserLabel(a)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="sm:col-span-2 flex items-start gap-2 text-xs text-foreground">
                    <Controller
                      control={control}
                      name={`signatureBlock.slots.${index}.useDigitalSignature`}
                      render={({ field: cb }) => (
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          disabled={!editApprover}
                          checked={cb.value !== false}
                          onChange={(e) => cb.onChange(e.target.checked)}
                        />
                      )}
                    />
                    <span>
                      <span className="font-medium">Dùng chữ ký số (ảnh) khi in PDF</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {useDigital === false
                          ? "Đang tắt — PDF chỉ in tên, không chèn ảnh chữ ký ô duyệt."
                          : selectedAdmin?.hasSignature ||
                              (approverIsSelf && currentUser?.profile?.signatureUrl)
                            ? "Đang bật — sẽ chèn ảnh chữ ký của người duyệt đã chọn (nếu có)."
                            : "Đang bật — người duyệt chưa có ảnh chữ ký trên hồ sơ; PDF vẫn in bình thường (ô trống)."}
                      </span>
                    </span>
                  </label>
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className={cn(
                  "grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4",
                  locked
                    ? "border-border/50 bg-muted/25"
                    : "border-border/70 bg-background",
                )}
              >
                <div className="sm:col-span-2 lg:col-span-4">
                  <p className="text-[10px] font-medium text-foreground">
                    {watch(`signatureBlock.slots.${index}.label`) || `Slot ${index + 1}`}
                    {locked ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                        Chỉ xem
                      </span>
                    ) : null}
                  </p>
                  {locked ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {lockedSlotHint(slotKey)}
                    </p>
                  ) : null}
                </div>
                <label className="text-[10px] text-muted-foreground">
                  Key
                  <input
                    className={cn(locked ? lockedInputClass : inputClass, "mt-0.5 font-mono text-xs")}
                    disabled
                    readOnly
                    {...register(`signatureBlock.slots.${index}.key`)}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Nhãn
                  <input
                    className={cn(locked ? lockedInputClass : inputClass, "mt-0.5")}
                    disabled={!canWrite || locked}
                    readOnly={locked}
                    {...register(`signatureBlock.slots.${index}.label`)}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Nguồn
                  <select
                    className={cn(locked ? lockedInputClass : inputClass, "mt-0.5")}
                    disabled={!canWrite || locked}
                    {...register(`signatureBlock.slots.${index}.source`)}
                  >
                    <option value="dynamic">Dynamic (từ phiếu)</option>
                    <option value="static">Static (mặc định đơn vị)</option>
                  </select>
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Tên static
                  <input
                    className={cn(locked ? lockedInputClass : inputClass, "mt-0.5")}
                    disabled={!canWrite || locked || source !== "static"}
                    readOnly={locked}
                    {...register(`signatureBlock.slots.${index}.static_name`)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!canWrite || saving || isLoading || isFetching}>
          {saving ? "Đang lưu…" : "Lưu cài đặt chữ ký"}
        </Button>
        {(isLoading || isFetching || loadingAdmins) && (
          <span className="text-[10px] text-muted-foreground">Đang tải…</span>
        )}
      </div>
    </form>
  );
}
