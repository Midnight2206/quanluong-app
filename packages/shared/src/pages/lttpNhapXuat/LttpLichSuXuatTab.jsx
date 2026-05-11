import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Pencil, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";
import httpClient from "@/services/httpClient";
import {
  useDeleteLttpIssueSlipMutation,
  useGetLttpIssueSlipsQuery,
} from "@/features/lttp/api/lttpApi";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { notifyError, notifySuccess } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { readLichSuFilters, writeLichSuFilters } from "./lttpNhapXuatSessionPersist";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfCurrentMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfCurrentMonthYmd() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return localYmd(last);
}

const PAGE_SIZE = 20;

async function formatBlobOrJsonError(err, fallback) {
  if (err?.response?.data instanceof Blob) {
    const text = await err.response.data.text().catch(() => "");
    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object" && j.message) {
        return String(j.message);
      }
    } catch {
      /* not JSON */
    }
    return text.trim() || fallback;
  }
  const m = err?.data?.message || err?.message;
  return typeof m === "string" && m.trim() ? m : fallback;
}

/**
 * Lịch sử phiếu xuất theo kho (storage) + lọc + in / sửa / thu hồi / in hàng loạt.
 */
export function LttpLichSuXuatTab({
  storageUnitId,
  units = [],
  canWrite,
  storageUnitName,
  onRequestEdit,
}) {
  const { confirm } = useConfirm();
  const [listFrom, setListFrom] = useState(() => firstDayOfCurrentMonthYmd());
  const [listTo, setListTo] = useState(() => lastDayOfCurrentMonthYmd());
  const [filterRecipientId, setFilterRecipientId] = useState("");
  const [page, setPage] = useState(1);

  const historyHydrateKey = useRef(null);
  /** Tránh ghi sessionStorage với state mặc định trước khi hydrate xong (layout chạy trước passive effect). */
  const historyFiltersReadyRef = useRef(false);
  useLayoutEffect(() => {
    historyFiltersReadyRef.current = false;
    if (!storageUnitId || !units.length) {
      return;
    }
    const k = `${storageUnitId}`;
    if (historyHydrateKey.current === k) {
      historyFiltersReadyRef.current = true;
      return;
    }
    historyHydrateKey.current = k;

    const stored = readLichSuFilters(storageUnitId);
    if (
      stored &&
      stored.filterRecipientId &&
      units.some((u) => String(u.id) === String(stored.filterRecipientId))
    ) {
      if (typeof stored.listFrom === "string" && /^\d{4}-\d{2}-\d{2}/.test(stored.listFrom)) {
        setListFrom(stored.listFrom);
      }
      if (typeof stored.listTo === "string" && /^\d{4}-\d{2}-\d{2}/.test(stored.listTo)) {
        setListTo(stored.listTo);
      }
      setFilterRecipientId(String(stored.filterRecipientId));
      const p = Number(stored.page);
      if (Number.isInteger(p) && p >= 1) {
        setPage(p);
      }
      historyFiltersReadyRef.current = true;
      return;
    }
    setFilterRecipientId((prev) => {
      if (prev && units.some((u) => String(u.id) === prev)) {
        return prev;
      }
      return String(units[0].id);
    });
    historyFiltersReadyRef.current = true;
  }, [storageUnitId, units]);

  useEffect(() => {
    if (!historyFiltersReadyRef.current || !storageUnitId || filterRecipientId === "") {
      return;
    }
    writeLichSuFilters(storageUnitId, { listFrom, listTo, filterRecipientId, page });
  }, [storageUnitId, listFrom, listTo, filterRecipientId, page]);

  useEffect(() => {
    setPage(1);
  }, [storageUnitId, listFrom, listTo, filterRecipientId]);

  const { data: slipsPayload, isLoading, refetch } = useGetLttpIssueSlipsQuery(
    {
      unitId: storageUnitId,
      from: listFrom,
      to: listTo,
      recipientUnitId: filterRecipientId === "" ? undefined : filterRecipientId,
      page,
      pageSize: PAGE_SIZE,
    },
    { skip: !storageUnitId || filterRecipientId === "" },
  );
  const slips = slipsPayload?.items ?? [];
  const total = Number(slipsPayload?.total ?? 0) || 0;
  /** Tổng số trang; luôn ≥ 1 để hiển thị đúng kể cả khi total = 0 */
  const pageCount = total <= 0 ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!isLoading && slips.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [isLoading, slips.length, page]);

  const [deleteSlip, { isLoading: delBusy }] = useDeleteLttpIssueSlipMutation();

  const [printingId, setPrintingId] = useState(null);
  const [batchPrintBusy, setBatchPrintBusy] = useState(false);

  /**
   * Phải `window.open` đồng bộ trong stack của sự kiện click — sau `await` trình duyệt coi là popup và chặn.
   * Mở tab trống trước, sau đó gán URL blob.
   */
  const openIssueSlipPdf = useCallback((slipId) => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này hoặc thử nút In trên thanh địa chỉ.");
      return;
    }
    setPrintingId(slipId);
    void (async () => {
      try {
        const res = await httpClient.get(`/lttp/issue-slips/${slipId}/print-pdf`, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } catch (err) {
        tab.close();
        notifyError(await formatBlobOrJsonError(err, "Không tải được PDF phiếu xuất."));
      } finally {
        setPrintingId(null);
      }
    })();
  }, []);

  const printCurrentPagePdfs = useCallback(() => {
    if (!slips.length) {
      return;
    }
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.");
      return;
    }
    setBatchPrintBusy(true);
    void (async () => {
      try {
        const res = await httpClient.post(
          "/lttp/issue-slips/print-pdfs",
          { ids: slips.map((s) => s.id) },
          { responseType: "blob" },
        );
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        tab.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } catch (err) {
        tab.close();
        notifyError(await formatBlobOrJsonError(err, "Không gộp PDF các phiếu."));
      } finally {
        setBatchPrintBusy(false);
      }
    })();
  }, [slips]);

  async function onRecall(s) {
    const ok = await confirm({
      title: "Thu hồi phiếu xuất?",
      message: `Xóa phiếu ${s.issueDate} — quyển ${s.bookMmyy} số ${String(s.slipNo).padStart(4, "0")}.`,
      confirmLabel: "Thu hồi",
    });
    if (!ok) {
      return;
    }
    try {
      await deleteSlip({ id: s.id });
      notifySuccess("Đã thu hồi phiếu.");
      refetch();
    } catch (err) {
      notifyError(err?.data?.message || err?.message || "Không thu hồi được.");
    }
  }

  return (
    <div className="border-y-[16px] border-white text-xs">
      <p className="text-[11px] text-muted-foreground">
        Kho cấp: <span className="font-medium text-foreground">{storageUnitName || `#${storageUnitId}`}</span> — lọc
        phiếu xuất đã lưu.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/30 p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-[9rem] space-y-0.5 text-[10px] text-muted-foreground">
          Từ ngày
          <input
            type="date"
            className={cn(inputClass, "mt-0.5 block")}
            value={listFrom}
            onChange={(e) => setListFrom(e.target.value)}
          />
        </label>
        <label className="min-w-[9rem] space-y-0.5 text-[10px] text-muted-foreground">
          Đến ngày
          <input
            type="date"
            className={cn(inputClass, "mt-0.5 block")}
            value={listTo}
            onChange={(e) => setListTo(e.target.value)}
          />
        </label>
        <label className="min-w-[12rem] flex-1 space-y-0.5 text-[10px] text-muted-foreground">
          Đơn vị nhận
          <select
            className={cn(inputClass, "mt-0.5 block")}
            value={filterRecipientId}
            onChange={(e) => setFilterRecipientId(e.target.value)}
            disabled={!units.length}
          >
            {units.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name ?? `Đơn vị #${u.id}`}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" className="h-8 text-xs" onClick={() => refetch()}>
          Tải lại
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[10px] text-muted-foreground">
          {total} phiếu / {pageCount} trang
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={isLoading || !slips.length || batchPrintBusy}
            onClick={() => printCurrentPagePdfs()}
            title="Gộp PDF các phiếu trên trang hiện tại"
          >
            {batchPrintBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
            In trang (PDF)
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-8 min-w-[5rem] text-xs"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trang trước
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="secondary"
            className="h-8 min-w-[5rem] text-xs"
            disabled={page >= pageCount || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-visible rounded-lg border border-border/60 pb-px">
        <table className="mb-px w-full min-w-[52rem] border-collapse text-left text-[11px]">
          <thead className="bg-secondary/90">
            <tr className="border-b border-border text-[9px] uppercase text-muted-foreground">
              <th className="px-2 py-2">Ngày xuất</th>
              <th className="px-2 py-2">Đơn vị nhận</th>
              <th className="min-w-[10rem] px-2 py-2">Chú thích phiếu</th>
              <th className="px-2 py-2">Số phiếu</th>
              <th className="px-2 py-2 text-right">Thành tiền</th>
              <th className="min-w-[15rem] whitespace-nowrap px-2 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-muted-foreground">
                  <Loader2 className="mr-1 inline size-3.5 animate-spin" />
                  Đang tải…
                </td>
              </tr>
            ) : null}
            {!isLoading && !slips.length ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-muted-foreground">
                  Không có phiếu phù hợp bộ lọc.
                </td>
              </tr>
            ) : null}
            {slips.map((s) => {
              const total = s.lines?.reduce((a, l) => a + (Number(l.amount) || 0), 0) ?? 0;
              const soPhieu = `Quyển ${s.bookMmyy} — Số ${String(s.slipNo).padStart(4, "0")}`;
              return (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="px-2 py-1.5 font-medium tabular-nums">{s.issueDate}</td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5" title={s.recipientUnit?.name ?? "—"}>
                    {s.recipientUnit?.name ?? "—"}
                  </td>
                  <td
                    className="max-w-[14rem] px-2 py-1.5 align-top text-[11px] leading-snug text-muted-foreground"
                    title={s.note != null && String(s.note).trim() !== "" ? String(s.note) : undefined}
                  >
                    {s.note != null && String(s.note).trim() !== "" ? (
                      <span className="line-clamp-3 text-foreground">{String(s.note).trim()}</span>
                    ) : (
                      <span className="italic opacity-60">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{soPhieu}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatVnd(total)}</td>
                  <td className="min-w-[15rem] whitespace-nowrap px-2 py-1.5 text-right align-middle">
                    <div className="flex flex-nowrap items-center justify-end gap-1">
                      <IconButton
                        label="In phiếu PDF"
                        variant="ghost"
                        className="h-7"
                        onClick={() => openIssueSlipPdf(s.id)}
                        disabled={printingId === s.id || delBusy || batchPrintBusy}
                      >
                        {printingId === s.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Printer className="size-3.5" />
                        )}
                      </IconButton>
                      {canWrite && typeof onRequestEdit === "function" ? (
                        <IconButton
                          label="Sửa phiếu"
                          variant="ghost"
                          className="h-7"
                          onClick={() => onRequestEdit(s)}
                          disabled={delBusy}
                        >
                          <Pencil className="size-3.5" />
                        </IconButton>
                      ) : null}
                      {canWrite ? (
                        <IconButton
                          label="Thu hồi"
                          variant="danger"
                          className="h-7"
                          onClick={() => onRecall(s)}
                          disabled={delBusy}
                        >
                          <RotateCcw className="size-3.5" />
                        </IconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
