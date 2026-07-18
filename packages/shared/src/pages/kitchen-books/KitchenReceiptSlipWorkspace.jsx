"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { TabPanel } from "@/components/common/TabPanel";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { IssueSlipCommoditySearch } from "@/components/lttp/IssueSlipCommoditySearch";
import { readPersistedNavTab } from "@/hooks/usePersistedNavTab";
import { cn } from "@/utils/cn";
import {
  useGetKitchenReceiptSlipByDayQuery,
  useGetKitchenReceiptSlipSerialQuery,
  useUpsertKitchenReceiptUnitSelfMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import {
  useGetLttpCommoditiesQuery,
  useGetLttpEffectivePricesQuery,
} from "@/features/lttp/api/lttpApi";
import { apiRequest } from "@/services/apiRequest";
import { notifyError, notifySuccess } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { vndToVietnameseDocumentLine } from "@/utils/vndVietnameseText";
import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  collectIssueSlipFormLineIssues,
  hasIssueSlipFormLineIssues,
  isIssueSlipLineInvalid,
  LTTP_ISSUE_SLIP_LINE_ISSUES_BANNER,
  LTTP_ISSUE_SLIP_DUPLICATE_LINE_MESSAGE,
  LTTP_ISSUE_SLIP_TRIPLE_COMMODITY_MESSAGE,
  normalizeIssueSlipPriceKind,
  resolveIssueSlipAppliedUnitPrice,
  suggestPriceKindForDuplicateCommodity,
} from "@/pages/lttpNhapXuat/lttpIssueSlipPriceKind";
import {
  bookMmyyFromYmd,
  buildTongHopDisplayRowsFromSlipLines,
  formatGuaranteeQtyDisplay,
  isReceiptSlipRowComplete,
  localYmd,
  newReceiptSlipEmptyRow,
  parsePositiveDecimalField,
  quantityInputDisplay,
  RECEIPT_LINE_SOURCE,
  rowFromReceiptSlipLine,
  visibleRowsForPriceKind,
} from "./kitchenReceiptSlipUtils";
import {
  readStoredKitchenReceiptDate,
  writeStoredKitchenReceiptDate,
} from "./kitchenBooksSessionPersist.js";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

const tableInputClass =
  "w-full min-w-0 rounded-md border border-border bg-background px-1 py-1 text-[11px] outline-none focus:border-primary";

const tableQtyDisplayClass =
  "flex h-7 w-full min-w-0 items-center justify-center rounded-md border border-border bg-muted/35 px-0.5 text-center text-[10px] tabular-nums text-muted-foreground";

const TABLE_SCROLL_WRAP =
  "min-w-0 max-h-[min(70vh,36rem)] overflow-auto overscroll-contain rounded-lg border border-border/60";

const stickyTheadClass =
  "sticky top-0 z-10 bg-secondary shadow-[0_1px_0_0_hsl(var(--border))]";

const RECEIPT_SUB_TAB_PERSIST = "kitchen-receipt-slip-sub";
const RECEIPT_SUB_TAB_IDS = ["mua-tt", "tgsx", "tong-hop"];

/**
 * Phiếu nhập kho bếp ăn — 1 phiếu/đơn vị/ngày; tab lọc Mua TT / TGSX / Tổng hợp.
 */
export function KitchenReceiptSlipWorkspace({
  selectedUnitId,
  canWrite,
  onSaved,
}) {
  const [receiptDate, setReceiptDateState] = useState(
    () => readStoredKitchenReceiptDate() ?? localYmd(),
  );
  const setReceiptDate = useCallback((next) => {
    setReceiptDateState(next);
    writeStoredKitchenReceiptDate(next);
  }, []);
  const [slipNote, setSlipNote] = useState("");
  const [rows, setRows] = useState(() => [newReceiptSlipEmptyRow()]);
  const [activeSubTab, setActiveSubTab] = useState(
    () => readPersistedNavTab(RECEIPT_SUB_TAB_PERSIST, RECEIPT_SUB_TAB_IDS) ?? "mua-tt",
  );
  const rowQtyRefs = useRef({});
  const rowCodeRefs = useRef({});
  const seededDayKeyRef = useRef("");
  const isTongHopTab = activeSubTab === "tong-hop";

  const { data: commodities = [], isLoading: cLoad } = useGetLttpCommoditiesQuery(
    selectedUnitId,
    { skip: selectedUnitId == null },
  );

  const { data: effPrices, isLoading: effPricesLoading } = useGetLttpEffectivePricesQuery(
    selectedUnitId != null && receiptDate
      ? { unitId: selectedUnitId, date: receiptDate }
      : undefined,
    { skip: selectedUnitId == null || !receiptDate },
  );

  const { data: serialData } = useGetKitchenReceiptSlipSerialQuery(
    { unitId: selectedUnitId, date: receiptDate },
    { skip: selectedUnitId == null || !receiptDate },
  );

  const {
    data: daySlip,
    isLoading: daySlipLoading,
    refetch: refetchDaySlip,
  } = useGetKitchenReceiptSlipByDayQuery(
    { unitId: selectedUnitId, date: receiptDate },
    { skip: selectedUnitId == null || !receiptDate },
  );

  const [upsertUnitSelf, { isLoading: saving }] = useUpsertKitchenReceiptUnitSelfMutation();

  const comById = useMemo(() => new Map(commodities.map((c) => [c.id, c])), [commodities]);

  const priceByCommodityId = useMemo(() => {
    const m = new Map();
    for (const item of effPrices?.items ?? []) {
      if (item?.commodity?.id != null) {
        m.set(item.commodity.id, item);
      }
    }
    return m;
  }, [effPrices?.items]);

  useEffect(() => {
    seededDayKeyRef.current = "";
  }, [selectedUnitId]);

  /** Nạp dòng unit_self từ phiếu ngày khi đổi đơn vị / ngày (hoặc sau khi ép reload). */
  useEffect(() => {
    const dayKey = `${selectedUnitId ?? ""}:${receiptDate}`;
    if (daySlipLoading) {
      return;
    }
    if (seededDayKeyRef.current === dayKey) {
      return;
    }
    seededDayKeyRef.current = dayKey;
    if (!daySlip) {
      setSlipNote("");
      setRows([newReceiptSlipEmptyRow()]);
      return;
    }
    setSlipNote(daySlip.note ?? "");
    const selfLines = (daySlip.lines ?? []).filter(
      (ln) => ln.lineSource !== RECEIPT_LINE_SOURCE.ON_GUARANTEE,
    );
    setRows(
      selfLines.length
        ? [...selfLines.map(rowFromReceiptSlipLine), newReceiptSlipEmptyRow()]
        : [newReceiptSlipEmptyRow()],
    );
  }, [selectedUnitId, receiptDate, daySlip, daySlipLoading]);

  /** Cập nhật đơn giá BĐ trên các dòng khi đổi ngày phiếu / bảng giá hiệu lực. */
  useEffect(() => {
    if (!effPrices?.items?.length) {
      return;
    }
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (!r.commodityId) {
          return r;
        }
        const hit = priceByCommodityId.get(r.commodityId);
        if (!hit) {
          return r;
        }
        const unitPrice = hit.unitPrice ?? null;
        const tgsxPrice = hit.tgsxPrice ?? null;
        if (r.unitPrice === unitPrice && r.tgsxPrice === tgsxPrice) {
          return r;
        }
        changed = true;
        let priceKind = r.priceKind;
        if (
          normalizeIssueSlipPriceKind(priceKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX &&
          tgsxPrice == null
        ) {
          priceKind = LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
        }
        return { ...r, unitPrice, tgsxPrice, priceKind };
      });
      return changed ? next : prev;
    });
  }, [effPrices?.items, priceByCommodityId, receiptDate]);

  const applyRowPatch = useCallback((key, patch) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) {
        return prev;
      }
      const merged = { ...prev[idx], ...patch };
      const next = prev.map((r, j) => (j === idx ? merged : r));
      if (idx === next.length - 1 && isReceiptSlipRowComplete(merged)) {
        return [
          ...next,
          newReceiptSlipEmptyRow(normalizeIssueSlipPriceKind(merged.priceKind)),
        ];
      }
      return next;
    });
  }, []);

  const onPickCommodity = useCallback(
    (key, commodityIdStr, { forcedKind } = {}) => {
      const id = Number(commodityIdStr);
      if (!Number.isInteger(id) || id <= 0) {
        applyRowPatch(key, {
          commodityId: "",
          codeDraft: "",
          unitPrice: null,
          tgsxPrice: null,
        });
        return;
      }
      const hit = priceByCommodityId.get(id);
      const c = comById.get(id);
      const tgsxAvailable = hit?.tgsxPrice != null;
      if (
        forcedKind != null &&
        normalizeIssueSlipPriceKind(forcedKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX &&
        !tgsxAvailable
      ) {
        notifyError("Mặt hàng này không có giá TGSX trên bảng giá hiệu lực.");
        return;
      }
      flushSync(() => {
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.key === key);
          if (idx < 0) {
            return prev;
          }
          const priceKind =
            forcedKind != null
              ? normalizeIssueSlipPriceKind(forcedKind)
              : suggestPriceKindForDuplicateCommodity(prev, key, id, { tgsxAvailable });
          const merged = {
            ...prev[idx],
            commodityId: id,
            codeDraft: c?.code ?? "",
            unitPrice: hit?.unitPrice ?? null,
            tgsxPrice: hit?.tgsxPrice ?? null,
            priceKind,
          };
          const next = prev.map((r, j) => (j === idx ? merged : r));
          if (idx === next.length - 1 && isReceiptSlipRowComplete(merged)) {
            return [...next, newReceiptSlipEmptyRow(priceKind)];
          }
          return next;
        });
      });
      queueMicrotask(() => {
        const el = rowQtyRefs.current[key];
        el?.focus?.();
        el?.select?.();
      });
    },
    [applyRowPatch, comById, priceByCommodityId],
  );

  const resolveByCode = useCallback(
    async (key, codeDraft, { focusQuantity = false, forcedKind } = {}) => {
      if (!selectedUnitId) {
        return;
      }
      const code = String(codeDraft ?? "").trim();
      if (!code) {
        return;
      }
      try {
        const d = await apiRequest({
          url: "/kitchen-books/receipt-slips/resolve",
          method: "get",
          params: { unitId: selectedUnitId, date: receiptDate, code },
        });
        const c = d?.commodity;
        if (!c?.id) {
          throw new Error("Phản hồi không hợp lệ");
        }
        const tgsxAvailable = d.tgsxPrice != null;
        if (
          forcedKind != null &&
          normalizeIssueSlipPriceKind(forcedKind) === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX &&
          !tgsxAvailable
        ) {
          notifyError("Mặt hàng này không có giá TGSX trên bảng giá hiệu lực.");
          return;
        }
        flushSync(() => {
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.key === key);
            if (idx < 0) {
              return prev;
            }
            const priceKind =
              forcedKind != null
                ? normalizeIssueSlipPriceKind(forcedKind)
                : suggestPriceKindForDuplicateCommodity(prev, key, c.id, { tgsxAvailable });
            const merged = {
              ...prev[idx],
              commodityId: c.id,
              codeDraft: c.code,
              unitPrice: d.unitPrice,
              tgsxPrice: d.tgsxPrice,
              priceKind,
            };
            const next = prev.map((r, j) => (j === idx ? merged : r));
            if (idx === next.length - 1 && isReceiptSlipRowComplete(merged)) {
              return [...next, newReceiptSlipEmptyRow(priceKind)];
            }
            return next;
          });
        });
        if (focusQuantity) {
          queueMicrotask(() => rowQtyRefs.current[key]?.focus?.());
        }
      } catch (err) {
        notifyError(err?.data?.message || err?.message || "Không tra được mã / giá.");
      }
    },
    [receiptDate, selectedUnitId],
  );

  const lineTotal = useCallback((r) => {
    const applied = resolveIssueSlipAppliedUnitPrice(r);
    if (applied == null) {
      return 0;
    }
    const q = parsePositiveDecimalField(r.quantity);
    if (!Number.isFinite(q)) {
      return 0;
    }
    return Math.round(q * applied * 100) / 100;
  }, []);

  const lineIssuesInForm = useMemo(
    () => collectIssueSlipFormLineIssues(rows),
    [rows],
  );

  const isDuplicateRow = useCallback(
    (r) => isIssueSlipLineInvalid(r, lineIssuesInForm),
    [lineIssuesInForm],
  );

  const hasLineIssues = hasIssueSlipFormLineIssues(lineIssuesInForm);
  const dataRows = useMemo(() => rows.filter(isReceiptSlipRowComplete), [rows]);
  const formTotal = useMemo(
    () => dataRows.reduce((s, r) => s + lineTotal(r), 0),
    [dataRows, lineTotal],
  );
  const totalInWords = useMemo(() => vndToVietnameseDocumentLine(formTotal), [formTotal]);

  const bookMmyy = bookMmyyFromYmd(receiptDate);
  const slipNoPreview = daySlip?.slipNo ?? serialData?.nextSlipNo ?? "—";

  const removeRow = useCallback((key) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [newReceiptSlipEmptyRow()];
      }
      const next = prev.filter((r) => r.key !== key);
      if (!next.some((r) => !r.commodityId)) {
        return [...next, newReceiptSlipEmptyRow()];
      }
      return next.length ? next : [newReceiptSlipEmptyRow()];
    });
  }, []);

  async function onSubmit(e) {
    e?.preventDefault();
    if (!selectedUnitId) {
      notifyError("Chưa chọn đơn vị.");
      return;
    }
    const toSave = rows.filter(isReceiptSlipRowComplete);
    if (!toSave.length) {
      notifyError("Cần ít nhất một dòng hợp lệ (mặt hàng, giá theo loại đã chọn, số lượng > 0).");
      return;
    }
    const issues = collectIssueSlipFormLineIssues(toSave);
    if (hasIssueSlipFormLineIssues(issues)) {
      const msg = issues.tripleCommodityIds.size
        ? LTTP_ISSUE_SLIP_TRIPLE_COMMODITY_MESSAGE
        : LTTP_ISSUE_SLIP_DUPLICATE_LINE_MESSAGE;
      notifyError(`${msg} — chỉnh các dòng trước khi lưu.`);
      return;
    }
    const noteTrim =
      slipNote != null && String(slipNote).trim() !== ""
        ? String(slipNote).trim().slice(0, 500)
        : null;

    const toPayloadLines = (kind) =>
      toSave
        .filter((r) => normalizeIssueSlipPriceKind(r.priceKind) === kind)
        .map((r) => ({
          commodityId: Number(r.commodityId),
          quantity: parsePositiveDecimalField(r.quantity),
          priceKind: kind,
          lineNote:
            r.lineNote != null && String(r.lineNote).trim() !== ""
              ? String(r.lineNote).trim().slice(0, 500)
              : null,
        }));

    try {
      // Upsert từng loại — không đụng on_guarantee; mảng rỗng = xóa hết unit_self loại đó.
      await upsertUnitSelf({
        unitId: selectedUnitId,
        receiptDate,
        note: noteTrim,
        priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
        lines: toPayloadLines(LTTP_ISSUE_SLIP_PRICE_KIND.MARKET),
      }).unwrap();
      await upsertUnitSelf({
        unitId: selectedUnitId,
        receiptDate,
        note: noteTrim,
        priceKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
        lines: toPayloadLines(LTTP_ISSUE_SLIP_PRICE_KIND.TGSX),
      }).unwrap();
      notifySuccess("Đã lưu phiếu nhập kho trong ngày.");
      seededDayKeyRef.current = "";
      await refetchDaySlip();
      onSaved?.();
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được phiếu nhập kho.");
    }
  }

  const marketRows = useMemo(
    () => visibleRowsForPriceKind(rows, LTTP_ISSUE_SLIP_PRICE_KIND.MARKET),
    [rows],
  );
  const tgsxRows = useMemo(
    () => visibleRowsForPriceKind(rows, LTTP_ISSUE_SLIP_PRICE_KIND.TGSX),
    [rows],
  );

  /** Tổng hợp: lines DB + draft unit_self đang nhập (chưa lưu). */
  const tongHopRows = useMemo(() => {
    const fromDb = daySlip?.lines ?? [];
    const draftSelf = dataRows.map((r) => ({
      commodityId: r.commodityId,
      commodity: { code: r.codeDraft },
      quantity: parsePositiveDecimalField(r.quantity),
      priceKind: r.priceKind,
      unitPrice: r.unitPrice,
      tgsxPrice: r.tgsxPrice,
      lineSource: RECEIPT_LINE_SOURCE.UNIT_SELF,
    }));
    const onGuarantee = fromDb.filter(
      (l) => l.lineSource === RECEIPT_LINE_SOURCE.ON_GUARANTEE,
    );
    return buildTongHopDisplayRowsFromSlipLines([...onGuarantee, ...draftSelf]);
  }, [daySlip?.lines, dataRows]);
  const tongHopTotal = useMemo(
    () => tongHopRows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [tongHopRows],
  );

  function renderKindEntryTable(visibleRows, forcedKind) {
    return (
      <div className="flex flex-col gap-2">
        {cLoad || effPricesLoading || daySlipLoading ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Đang tải" />
        ) : null}
        <div className={TABLE_SCROLL_WRAP}>
          <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 text-left text-[11px]">
            <colgroup>
              <col style={{ width: "2.5rem" }} />
              <col />
              <col style={{ width: "7rem" }} />
              <col style={{ width: "6.5rem" }} />
              <col style={{ width: "7rem" }} />
              <col style={{ width: "7rem" }} />
              <col style={{ width: "2.5rem" }} />
            </colgroup>
            <thead className={stickyTheadClass}>
              <tr className="text-[9px] uppercase text-muted-foreground">
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-center">TT</th>
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-left">
                  Tên mặt hàng
                </th>
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-left">
                  Mã số / ĐVT
                </th>
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-center">
                  Số lượng
                </th>
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-right">
                  Đơn giá
                </th>
                <th className="border-b border-border bg-secondary px-1 py-1.5 text-right">
                  Thành tiền
                </th>
                <th className="border-b border-border bg-secondary px-0.5 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const c = r.commodityId ? comById.get(r.commodityId) : null;
                const dupRow = isDuplicateRow(r);
                const rowDisabled = !canWrite || !r.commodityId;
                const applied = resolveIssueSlipAppliedUnitPrice(r);
                const total = lineTotal(r);
                const commodityLabel = c ? `${c.name} (${c.code})` : "";
                return (
                  <tr
                    key={r.key}
                    className={cn(
                      "align-top",
                      dupRow && "bg-red-500/8 dark:bg-red-950/20",
                    )}
                  >
                    <td className="border-b border-border/50 px-1 py-1 text-center tabular-nums text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="border-b border-border/50 px-1 py-1">
                      <IssueSlipCommoditySearch
                        rowKey={r.key}
                        commodityId={r.commodityId}
                        selectedLabel={commodityLabel}
                        commodities={commodities}
                        dupRow={dupRow}
                        inputClass={tableInputClass}
                        disabled={!canWrite}
                        onPickCommodity={(key, id) =>
                          onPickCommodity(key, id, { forcedKind })
                        }
                      />
                    </td>
                    <td className="border-b border-border/50 px-1 py-1">
                      <input
                        ref={(el) => {
                          rowCodeRefs.current[r.key] = el;
                        }}
                        className={cn(
                          tableInputClass,
                          "font-mono",
                          dupRow && "border-red-500/90",
                        )}
                        value={r.codeDraft}
                        disabled={!canWrite}
                        onChange={(e) => applyRowPatch(r.key, { codeDraft: e.target.value })}
                        onBlur={() =>
                          void resolveByCode(r.key, r.codeDraft, { forcedKind })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void resolveByCode(r.key, r.codeDraft, {
                              focusQuantity: true,
                              forcedKind,
                            });
                          }
                        }}
                        placeholder="Mã"
                      />
                      <span className="mt-0.5 block truncate text-[9px] text-muted-foreground">
                        {c?.measureUnit ?? "—"}
                      </span>
                    </td>
                    <td className="border-b border-border/50 px-1 py-1">
                      <input
                        ref={(el) => {
                          rowQtyRefs.current[r.key] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        disabled={rowDisabled}
                        className={cn(
                          tableInputClass,
                          "text-center tabular-nums",
                          dupRow && "border-red-500/90",
                        )}
                        value={quantityInputDisplay(r.quantity)}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^\d.,]/g, "");
                          applyRowPatch(r.key, { quantity: cleaned });
                        }}
                      />
                    </td>
                    <td className="border-b border-border/50 px-1 py-1 text-right text-[10px] tabular-nums">
                      {applied != null ? formatVnd(applied) : "—"}
                    </td>
                    <td className="border-b border-border/50 px-1 py-1 text-right text-[10px] font-medium tabular-nums">
                      {formatVnd(total)}
                    </td>
                    <td className="border-b border-border/50 px-0.5 py-1 text-right">
                      <IconButton
                        type="button"
                        label="Xóa dòng"
                        variant="ghost"
                        disabled={!canWrite}
                        onClick={() => removeRow(r.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
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

  function tongHopQtyHead(group, kind) {
    return (
      <th className="border-b border-border bg-secondary px-1 py-1.5 text-center text-[9px] uppercase leading-tight text-muted-foreground">
        <span className="block text-[8px] font-normal normal-case tracking-normal text-muted-foreground/90">
          {group}
        </span>
        <span className="block">{kind}</span>
      </th>
    );
  }

  const tongHopPanel = (
    <div className="flex flex-col gap-2">
      <div className={TABLE_SCROLL_WRAP}>
        {/* 1 hàng header = 1 cột body — tránh rowspan/colspan làm lệch cột với table-fixed */}
        <table className="w-full min-w-[48rem] table-fixed border-separate border-spacing-0 text-left text-[11px]">
          <colgroup>
            <col style={{ width: "2.25rem" }} />
            <col />
            <col style={{ width: "6.5rem" }} />
            <col style={{ width: "5.25rem" }} />
            <col style={{ width: "5.25rem" }} />
            <col style={{ width: "5.25rem" }} />
            <col style={{ width: "5.25rem" }} />
            <col style={{ width: "6.5rem" }} />
            <col style={{ width: "6.5rem" }} />
          </colgroup>
          <thead className={stickyTheadClass}>
            <tr>
              <th className="border-b border-border bg-secondary px-1 py-1.5 text-center text-[9px] uppercase text-muted-foreground">
                TT
              </th>
              <th className="border-b border-border bg-secondary px-1 py-1.5 text-left text-[9px] uppercase text-muted-foreground">
                Tên mặt hàng
              </th>
              <th className="border-b border-border bg-secondary px-1 py-1.5 text-left text-[9px] uppercase text-muted-foreground">
                Mã số / ĐVT
              </th>
              {tongHopQtyHead("Trên BĐ", "Mua TT")}
              {tongHopQtyHead("Trên BĐ", "TGSX")}
              {tongHopQtyHead("Đơn vị BĐ", "Mua TT")}
              {tongHopQtyHead("Đơn vị BĐ", "TGSX")}
              <th className="border-b border-border bg-secondary px-1 py-1.5 text-right text-[9px] uppercase text-muted-foreground">
                Đơn giá
              </th>
              <th className="border-b border-border bg-secondary px-1 py-1.5 text-right text-[9px] uppercase text-muted-foreground">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {tongHopRows.map((r, i) => {
              const c = r.commodityId ? comById.get(r.commodityId) : null;
              const name = c?.name ?? "—";
              const code = r.commodityCode || c?.code || "—";
              return (
                <tr key={r.key} className="align-middle">
                  <td className="border-b border-border/50 px-1 py-1 text-center tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="border-b border-border/50 px-1 py-1">{name}</td>
                  <td className="border-b border-border/50 px-1 py-1">
                    <span className="font-mono">{code}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-muted-foreground">
                      {c?.measureUnit ?? "—"}
                    </span>
                  </td>
                  <td className="border-b border-border/50 px-1 py-1">
                    <div className={cn(tableQtyDisplayClass, "bg-muted/50")}>
                      {formatGuaranteeQtyDisplay(r.trenBdMarket)}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-1 py-1">
                    <div className={cn(tableQtyDisplayClass, "bg-muted/50")}>
                      {formatGuaranteeQtyDisplay(r.trenBdTgsx)}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-1 py-1">
                    <div className={tableQtyDisplayClass}>
                      {formatGuaranteeQtyDisplay(r.donViMarket)}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-1 py-1">
                    <div className={tableQtyDisplayClass}>
                      {formatGuaranteeQtyDisplay(r.donViTgsx)}
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-1 py-1 text-right text-[10px] tabular-nums">
                    {formatVnd(r.unitPrice)}
                  </td>
                  <td className="border-b border-border/50 px-1 py-1 text-right text-[10px] font-medium tabular-nums">
                    {formatVnd(r.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tongHopRows.length ? (
        <div className="text-right text-[11px] text-muted-foreground">
          Tổng hợp thành tiền:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatVnd(tongHopTotal)}
          </span>
        </div>
      ) : null}
    </div>
  );

  const subTabs = [
    {
      id: "mua-tt",
      label: "Mua TT",
      panel: renderKindEntryTable(marketRows, LTTP_ISSUE_SLIP_PRICE_KIND.MARKET),
    },
    {
      id: "tgsx",
      label: "TGSX",
      panel: renderKindEntryTable(tgsxRows, LTTP_ISSUE_SLIP_PRICE_KIND.TGSX),
    },
    { id: "tong-hop", label: "Tổng hợp", panel: tongHopPanel },
  ];

  return (
    <form className="flex min-h-0 flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card/40 p-3">
        <label className="space-y-0.5 text-xs">
          <span className="text-muted-foreground">Ngày phiếu</span>
          <input
            type="date"
            className={inputClass}
            value={receiptDate}
            disabled={!canWrite}
            onChange={(e) => {
              seededDayKeyRef.current = "";
              setReceiptDate(e.target.value);
            }}
          />
        </label>
        <div className="text-xs text-muted-foreground">
          Quyển / Số:{" "}
          <span className="font-mono font-medium text-foreground">
            Q.{bookMmyy} — Số {String(slipNoPreview ?? "—").padStart(4, "0")}
          </span>
        </div>
        <label className="min-w-[12rem] flex-1 space-y-0.5 text-xs">
          <span className="text-muted-foreground">Ghi chú phiếu</span>
          <input
            className={inputClass}
            value={slipNote}
            disabled={!canWrite}
            onChange={(e) => setSlipNote(e.target.value)}
            placeholder="Tuỳ chọn"
          />
        </label>
      </div>

      {hasLineIssues ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-[11px] font-medium leading-snug text-destructive"
        >
          {LTTP_ISSUE_SLIP_LINE_ISSUES_BANNER}
        </div>
      ) : null}

      <TabPanel
        scrollablePanel={false}
        scrollableTabList
        equalWidthTabs={false}
        persistId={RECEIPT_SUB_TAB_PERSIST}
        defaultTabId="mua-tt"
        onTabSelect={(id) => {
          setActiveSubTab(id);
          if (id === "tong-hop") {
            void refetchDaySlip();
          }
        }}
        tabs={subTabs}
      />

      {!isTongHopTab ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
            <div>
              <div className="text-xs font-medium">Tổng cộng (đơn vị tự bảo đảm)</div>
              <div className="text-[10px] italic text-muted-foreground">
                {totalInWords || "—"}
              </div>
            </div>
            <div className="text-base font-semibold tabular-nums">{formatVnd(formTotal)}</div>
          </div>

          {canWrite ? (
            <div className="flex justify-end">
              <Button
                type="submit"
                className="h-10 gap-1.5 px-4 text-xs"
                disabled={saving || !dataRows.length || hasLineIssues}
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Lưu phiếu nhập kho
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </form>
  );
}
