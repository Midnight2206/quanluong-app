import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useCreateMealAllowanceRateMutation,
  useDeleteMealAllowanceRateMutation,
  useGetMealAllowanceRatesQuery,
  usePatchMealAllowanceRateMutation,
} from "@/features/meal-allowance-rates/api/mealAllowanceRatesApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { cn } from "@/utils/cn";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

const TYPE_OPTIONS = [
  { value: "an_tieu_chuan", label: "Ăn tiêu chuẩn" },
  { value: "an_them", label: "Ăn thêm" },
];

function typeLabel(v) {
  return TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const emptyDraft = () => ({
  doiTuong: "",
  mucTienAn: "",
  type: "an_tieu_chuan",
});

export function SuperadminMealAllowanceRatesPanel() {
  const { confirm } = useConfirm();
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";
  const { data: rows = [], isLoading, isError } = useGetMealAllowanceRatesQuery();
  const [createRow, { isLoading: creating }] = useCreateMealAllowanceRateMutation();
  const [patchRow, { isLoading: patching }] = usePatchMealAllowanceRateMutation();
  const [removeRow, { isLoading: deleting }] = useDeleteMealAllowanceRateMutation();

  const [filterType, setFilterType] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const filtered = useMemo(() => {
    if (filterType === "all") {
      return rows;
    }
    return rows.filter((r) => r.type === filterType);
  }, [rows, filterType]);

  function openAddModal() {
    setDraft({
      ...emptyDraft(),
      type: filterType === "an_them" ? "an_them" : "an_tieu_chuan",
    });
    setAddOpen(true);
  }

  function closeAddModal() {
    setAddOpen(false);
    setDraft(emptyDraft());
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditForm({
      doiTuong: row.doiTuong,
      mucTienAn: String(row.mucTienAn),
      type: row.type,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editForm || editingId == null) {
      return;
    }
    const muc = Number(editForm.mucTienAn);
    if (!editForm.doiTuong.trim()) {
      notifyError("Nhập đối tượng.");
      return;
    }
    if (!Number.isFinite(muc) || muc < 0) {
      notifyError("Mức tiền ăn không hợp lệ.");
      return;
    }
    try {
      await patchRow({
        id: editingId,
        body: {
          doiTuong: editForm.doiTuong.trim(),
          mucTienAn: muc,
          type: editForm.type,
        },
      }).unwrap();
      notifySuccess("Đã lưu.");
      cancelEdit();
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được.");
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    const muc = Number(draft.mucTienAn);
    if (!draft.doiTuong.trim()) {
      notifyError("Nhập đối tượng.");
      return;
    }
    if (!Number.isFinite(muc) || muc < 0) {
      notifyError("Mức tiền ăn không hợp lệ.");
      return;
    }
    try {
      await createRow({
        doiTuong: draft.doiTuong.trim(),
        mucTienAn: muc,
        type: draft.type,
      }).unwrap();
      notifySuccess("Đã thêm mục.");
      closeAddModal();
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được.");
    }
  }

  async function onDelete(id) {
    const ok = await confirm({
      title: "Xóa mục",
      message: "Xóa mục mức tiền ăn này?",
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    try {
      await removeRow(id).unwrap();
      notifySuccess("Đã xóa.");
      if (editingId === id) {
        cancelEdit();
      }
    } catch (err) {
      notifyError(err?.data?.message || "Không xóa được.");
    }
  }

  const editOpen = editingId != null && editForm != null;

  return (
    <Card className="shadow-soft w-full min-w-0">
      <CardContent className="flex flex-col gap-3 !p-3 sm:!p-4">
        <div className="space-y-1 shrink-0">
          <p className="text-xs font-medium sm:text-sm">Danh mục mức tiền ăn</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Dữ liệu công khai (đồng/người/ngày). Mọi tài khoản đã đăng nhập có thể đọc qua API; chỉ{" "}
            <span className="font-medium text-foreground">superadmin</span> được thêm, sửa, xóa trên giao diện này.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "Tất cả" },
              { id: "an_tieu_chuan", label: "Ăn tiêu chuẩn" },
              { id: "an_them", label: "Ăn thêm" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition sm:text-xs",
                  filterType === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/80",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {isSuperadmin ? (
            <Button type="button" className="h-8 gap-1 px-3 text-xs sm:ml-auto" onClick={openAddModal}>
              <Plus className="size-3.5" aria-hidden />
              Thêm mục
            </Button>
          ) : null}
        </div>

        {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
        {isError ? <p className="text-xs text-destructive">Không tải được danh mục.</p> : null}

        {!isLoading && !isError ? (
          <div className="rounded-lg border border-border/60">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
              <thead className="sticky top-0 z-[1] bg-secondary/95">
                <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Loại</th>
                  <th className="min-w-[12rem] px-2 py-2 font-medium">Đối tượng</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Mức (đ/ngày)</th>
                  {isSuperadmin ? <th className="px-2 py-2 text-right font-medium">Thao tác</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSuperadmin ? 4 : 3}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      Chưa có dữ liệu. Chạy seed backend hoặc thêm mục mới.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 align-top hover:bg-muted/20">
                      <td className="px-2 py-2 text-[11px] text-muted-foreground">{typeLabel(row.type)}</td>
                      <td className="px-2 py-2">
                        <span className="whitespace-pre-wrap leading-snug">{row.doiTuong}</span>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{formatVnd(row.mucTienAn)}</td>
                      {isSuperadmin ? (
                        <td className="px-2 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <IconButton label="Sửa" variant="surface" onClick={() => startEdit(row)}>
                              <Pencil aria-hidden />
                            </IconButton>
                            <IconButton
                              label="Xóa"
                              variant="danger"
                              disabled={deleting}
                              onClick={() => onDelete(row.id)}
                            >
                              <Trash2 aria-hidden />
                            </IconButton>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>

      {addOpen && isSuperadmin ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
            aria-label="Đóng"
            onClick={closeAddModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-rate-add-title"
            className="relative flex max-h-[min(92dvh,32rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <p
                id="meal-rate-add-title"
                className="text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                Thêm mục mức tiền ăn
              </p>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Đóng"
                onClick={closeAddModal}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <form
              onSubmit={onCreate}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5"
            >
              <label className="block space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Đối tượng</span>
                <textarea
                  className={cn(inputClass, "min-h-[4rem] resize-y")}
                  value={draft.doiTuong}
                  onChange={(e) => setDraft((d) => ({ ...d, doiTuong: e.target.value }))}
                  rows={3}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Mức tiền ăn (đ)</span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={draft.mucTienAn}
                    onChange={(e) => setDraft((d) => ({ ...d, mucTienAn: e.target.value }))}
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Loại</span>
                  <select
                    className={cn(inputClass, "py-1.5")}
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="submit" className="h-8 gap-1 text-xs" disabled={creating}>
                  {creating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                  Thêm
                </Button>
                <Button type="button" variant="ghost" className="h-8 text-xs" onClick={closeAddModal}>
                  Huỷ
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen && isSuperadmin ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
            aria-label="Đóng"
            onClick={cancelEdit}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-rate-edit-title"
            className="relative flex max-h-[min(92dvh,32rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <p
                id="meal-rate-edit-title"
                className="text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                Sửa mục mức tiền ăn
              </p>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Đóng"
                onClick={cancelEdit}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5"
            >
              <label className="block space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Đối tượng</span>
                <textarea
                  className={cn(inputClass, "min-h-[4rem] resize-y")}
                  value={editForm.doiTuong}
                  onChange={(e) => setEditForm((f) => ({ ...f, doiTuong: e.target.value }))}
                  rows={3}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Mức tiền ăn (đ)</span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={editForm.mucTienAn}
                    onChange={(e) => setEditForm((f) => ({ ...f, mucTienAn: e.target.value }))}
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Loại</span>
                  <select
                    className={cn(inputClass, "py-1.5")}
                    value={editForm.type}
                    onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="submit" className="h-8 gap-1 text-xs" disabled={patching}>
                  {patching ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
                  Lưu
                </Button>
                <Button type="button" variant="ghost" className="h-8 text-xs" onClick={cancelEdit}>
                  Huỷ
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
