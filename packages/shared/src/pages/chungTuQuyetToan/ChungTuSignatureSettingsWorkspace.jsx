"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  useChungTuSignatureSettingsQuery,
  useUpsertChungTuSignatureSettingsMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { ChungTuExportWizardCard } from "./ChungTuExportWizard";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

const slotSchema = z.object({
  key: z.string().trim().min(1, "Nhập key slot."),
  label: z.string().trim().min(1, "Nhập nhãn hiển thị."),
  col: z.coerce.number().int().min(0, "Cột bắt đầu từ 0."),
  col_span: z.coerce.number().int().min(1, "Độ rộng tối thiểu là 1."),
  source: z.enum(["dynamic", "static"]),
  static_name: z.string().optional().default(""),
  show_date_line: z.boolean().default(false),
});

const signatureBlockSchema = z.object({
  columns: z.coerce.number().int().min(1, "Số cột tối thiểu là 1.").max(6, "Tối đa 6 cột."),
  gap_pt: z.coerce.number().min(0, "Khoảng cách không âm."),
  date_line_gap_pt: z.coerce.number().min(0, "Khoảng cách không âm."),
  slots: z.array(slotSchema).min(1, "Cần ít nhất một vị trí ký."),
});

const formSchema = z.object({
  signatureBlock: signatureBlockSchema,
});

const DEFAULT_SIGNATURE_BLOCK = Object.freeze({
  columns: 2,
  gap_pt: 40,
  date_line_gap_pt: 14,
  slots: [
    {
      key: "nguoi_lap",
      label: "Người lập",
      col: 0,
      col_span: 1,
      source: "dynamic",
      static_name: "",
      show_date_line: false,
    },
    {
      key: "thu_truong",
      label: "Thủ trưởng đơn vị",
      col: 1,
      col_span: 1,
      source: "dynamic",
      static_name: "",
      show_date_line: false,
    },
  ],
});

function cloneDefaultSignatureBlock() {
  return {
    columns: DEFAULT_SIGNATURE_BLOCK.columns,
    gap_pt: DEFAULT_SIGNATURE_BLOCK.gap_pt,
    date_line_gap_pt: DEFAULT_SIGNATURE_BLOCK.date_line_gap_pt,
    slots: DEFAULT_SIGNATURE_BLOCK.slots.map((slot) => ({ ...slot })),
  };
}

function normalizeSlot(slot, index) {
  return {
    key: String(slot?.key ?? "").trim(),
    label: String(slot?.label ?? "").trim(),
    col: Number.isFinite(Number(slot?.col)) ? Number(slot.col) : index,
    col_span: Number.isFinite(Number(slot?.col_span)) ? Number(slot.col_span) : 1,
    source: slot?.source === "static" ? "static" : "dynamic",
    static_name: String(slot?.static_name ?? "").trim(),
    show_date_line: Boolean(slot?.show_date_line),
  };
}

function normalizeSignatureBlock(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.slots) || input.slots.length === 0) {
    return cloneDefaultSignatureBlock();
  }
  const slots = input.slots.map(normalizeSlot).filter((slot) => slot.key && slot.label);
  if (slots.length === 0) {
    return cloneDefaultSignatureBlock();
  }
  return {
    columns: Number.isFinite(Number(input.columns)) ? Number(input.columns) : 2,
    gap_pt: Number.isFinite(Number(input.gap_pt)) ? Number(input.gap_pt) : 40,
    date_line_gap_pt: Number.isFinite(Number(input.date_line_gap_pt))
      ? Number(input.date_line_gap_pt)
      : 14,
    slots,
  };
}

function buildEmptySlot(nextIndex) {
  return {
    key: "",
    label: "",
    col: nextIndex,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    show_date_line: false,
  };
}

/**
 * @param {{ categoryKey: string }} props
 */
export function ChungTuSignatureSettingsWorkspace({ categoryKey }) {
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const {
    data: savedSettings,
    isLoading,
    isFetching,
  } = useChungTuSignatureSettingsQuery(categoryKey, { skip: !categoryKey });
  const [saveSettings, { isLoading: saving }] = useUpsertChungTuSignatureSettingsMutation();

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      signatureBlock: cloneDefaultSignatureBlock(),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "signatureBlock.slots",
  });

  useEffect(() => {
    reset({
      signatureBlock: normalizeSignatureBlock(savedSettings?.signatureBlock),
    });
  }, [reset, savedSettings]);

  const slotValues = watch("signatureBlock.slots");

  const handleResetDefault = () => {
    reset({ signatureBlock: cloneDefaultSignatureBlock() });
  };

  const onSubmit = async ({ signatureBlock }) => {
    try {
      const payload = normalizeSignatureBlock(signatureBlock);
      await saveSettings({
        categoryKey,
        signatureBlock: payload,
      }).unwrap();
      reset({ signatureBlock: payload });
      notifySuccess("Đã lưu cài đặt chữ ký.");
    } catch (error) {
      notifyError(error?.data?.message || error?.message || "Không lưu được cài đặt chữ ký.");
    }
  };

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <ChungTuExportWizardCard
        title="Khối chữ ký"
        description="Cấu hình số cột, khoảng cách và các vị trí ký dùng chung cho loại chứng từ này."
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Số cột
              </span>
              <input
                type="number"
                min="1"
                max="6"
                step="1"
                className={fieldClass}
                disabled={!canWrite || isLoading || saving}
                {...register("signatureBlock.columns")}
              />
              {errors.signatureBlock?.columns ? (
                <p className="text-xs text-destructive">{errors.signatureBlock.columns.message}</p>
              ) : null}
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Gap chữ ký (pt)
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                className={fieldClass}
                disabled={!canWrite || isLoading || saving}
                {...register("signatureBlock.gap_pt")}
              />
              {errors.signatureBlock?.gap_pt ? (
                <p className="text-xs text-destructive">{errors.signatureBlock.gap_pt.message}</p>
              ) : null}
            </label>

            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Gap dòng ngày ký (pt)
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                className={fieldClass}
                disabled={!canWrite || isLoading || saving}
                {...register("signatureBlock.date_line_gap_pt")}
              />
              {errors.signatureBlock?.date_line_gap_pt ? (
                <p className="text-xs text-destructive">
                  {errors.signatureBlock.date_line_gap_pt.message}
                </p>
              ) : null}
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                  Vị trí ký
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Key sẽ được dùng ở màn Xuất để nhập tên người ký.
                </p>
              </div>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  disabled={isLoading || saving}
                  onClick={() => append(buildEmptySlot(fields.length))}
                >
                  <Plus className="size-3.5" />
                  Thêm vị trí
                </Button>
              ) : null}
            </div>

            {errors.signatureBlock?.slots?.message ? (
              <p className="text-xs text-destructive">{errors.signatureBlock.slots.message}</p>
            ) : null}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const slotError = errors.signatureBlock?.slots?.[index];
                const slotValue = slotValues?.[index];
                return (
                  <section
                    key={field.id}
                    className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Vị trí {index + 1}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Slot {slotValue?.source === "static" ? "tên cố định" : "nhập tên khi xuất"}.
                        </p>
                      </div>
                      {canWrite && fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="dangerGhost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          disabled={saving}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-3.5" />
                          Xóa
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Key
                        </span>
                        <input
                          className={fieldClass}
                          disabled={!canWrite || saving}
                          placeholder="vi_du: ke_toan"
                          {...register(`signatureBlock.slots.${index}.key`)}
                        />
                        {slotError?.key ? (
                          <p className="text-xs text-destructive">{slotError.key.message}</p>
                        ) : null}
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Nhãn hiển thị
                        </span>
                        <textarea
                          rows={2}
                          className={cn(fieldClass, "min-h-20 resize-y py-2")}
                          disabled={!canWrite || saving}
                          placeholder={"Ví dụ:\nKế toán trưởng"}
                          {...register(`signatureBlock.slots.${index}.label`)}
                        />
                        {slotError?.label ? (
                          <p className="text-xs text-destructive">{slotError.label.message}</p>
                        ) : null}
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Nguồn tên ký
                        </span>
                        <select
                          className={fieldClass}
                          disabled={!canWrite || saving}
                          {...register(`signatureBlock.slots.${index}.source`)}
                        >
                          <option value="dynamic">Nhập khi xuất</option>
                          <option value="static">Tên cố định</option>
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Cột
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className={fieldClass}
                          disabled={!canWrite || saving}
                          {...register(`signatureBlock.slots.${index}.col`)}
                        />
                        {slotError?.col ? (
                          <p className="text-xs text-destructive">{slotError.col.message}</p>
                        ) : null}
                      </label>

                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Độ rộng cột
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={fieldClass}
                          disabled={!canWrite || saving}
                          {...register(`signatureBlock.slots.${index}.col_span`)}
                        />
                        {slotError?.col_span ? (
                          <p className="text-xs text-destructive">{slotError.col_span.message}</p>
                        ) : null}
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Tên ký cố định
                        </span>
                        <input
                          className={fieldClass}
                          disabled={!canWrite || saving || slotValue?.source !== "static"}
                          placeholder="Chỉ dùng khi chọn Tên cố định"
                          {...register(`signatureBlock.slots.${index}.static_name`)}
                        />
                      </label>

                      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          disabled={!canWrite || saving}
                          {...register(`signatureBlock.slots.${index}.show_date_line`)}
                        />
                        <span>Hiển thị dòng ngày ký cho vị trí này</span>
                      </label>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            {canWrite ? (
              <>
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 gap-1.5 text-xs"
                  disabled={isLoading || saving || !isDirty}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Lưu cấu hình
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 text-xs"
                  disabled={saving}
                  onClick={handleResetDefault}
                >
                  <RotateCcw className="size-3.5" />
                  Khôi phục mặc định
                </Button>
              </>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {isLoading || isFetching
                ? "Đang tải cài đặt chữ ký…"
                : savedSettings?.updatedAt
                  ? `Đã lưu gần nhất: ${new Date(savedSettings.updatedAt).toLocaleString("vi-VN")}.`
                  : "Chưa có cấu hình lưu riêng, hệ thống đang dùng mặc định."}
            </p>
          </div>
        </form>
      </ChungTuExportWizardCard>
    </div>
  );
}
