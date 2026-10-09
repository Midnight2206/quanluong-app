"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import {
  useLttpSupplierLedgerQuery,
  useLttpSupplierLinksQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { cn } from "@/utils/cn";
import { initialSupplierId, pairLabel } from "./supplierOrderView.js";
import {
  commodityBlocks,
  formatLedgerMoney,
  recipientBlocks,
} from "./supplierLedgerView.js";

const COLUMN_TINTS = [
  "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
  "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
  "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50",
  "bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-50",
  "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-50",
  "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-50",
];

const fieldLabelClass = "text-xs font-medium leading-4 text-foreground";
const fieldControlClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";

function monthRange() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [year, month] = today.split("-");
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, "0")}`,
  };
}

function ledgerErrorText(error) {
  const formError = error?.data?.details?.formErrors?.[0];
  if (typeof formError === "string" && formError !== "") return formError;
  return "Không tải được sổ công nợ.";
}

function showDate(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${day}/${month}/${year}`;
}

function MoneyLine({ lead, unitPrice, amount, showPrice }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm leading-6">
      <p className="min-w-0 flex-1">{lead}</p>
      {showPrice ? (
        <>
          <span className="text-muted-foreground">×</span>
          <span className="tabular-nums">{unitPrice == null ? "—" : formatLedgerMoney(unitPrice)}</span>
        </>
      ) : null}
      <span className="text-muted-foreground">=</span>
      <span className="tabular-nums font-semibold">{formatLedgerMoney(amount)}</span>
    </div>
  );
}

function DayDetail({ day, viewMode }) {
  if (viewMode === "recipient") {
    return (
      <div className="space-y-3">
        {recipientBlocks(day.lines).map((block) => (
          <div key={block.name} className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{block.name}</p>
            <MoneyLine lead={block.items.join(" + ")} amount={block.amount} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {commodityBlocks(day.lines).map((block) => (
        <MoneyLine
          key={`${block.name}-${block.unitPrice ?? ""}`}
          lead={<><span className="font-medium">{block.name}:</span> {block.parts.join(" + ")}</>}
          unitPrice={block.unitPrice}
          amount={block.amount}
          showPrice
        />
      ))}
    </div>
  );
}

export function SupplierLedgerPage() {
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [supplierId, setSupplierId] = useState(null);
  const [viewMode, setViewMode] = useState("commodity");
  const [openDate, setOpenDate] = useState(null);
  const readyRef = useRef(false);

  const {
    draft,
    setDraftPayload: persistLedger,
    ready: persistReady,
  } = useDraftPersist({ draftType: "supplier-ledger", scopeId: "global" });

  const { data: linksData, isLoading: linksLoading, error: linksError } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];

  useLayoutEffect(() => {
    if (!persistReady || readyRef.current) return;
    readyRef.current = true;
    if (typeof draft?.from === "string") setFrom(draft.from);
    if (typeof draft?.to === "string") setTo(draft.to);
    if (draft && (draft.supplierId == null || (Number.isInteger(draft.supplierId) && draft.supplierId > 0))) {
      setSupplierId(draft.supplierId ?? null);
    }
    if (draft?.viewMode === "recipient" || draft?.viewMode === "commodity") setViewMode(draft.viewMode);
  }, [persistReady, draft]);

  useEffect(() => {
    const nextSupplierId = initialSupplierId(links);
    if (nextSupplierId != null) {
      setSupplierId(nextSupplierId);
      return;
    }
    if (supplierId != null && !links.some((link) => Number(link.supplierId) === Number(supplierId))) {
      setSupplierId(null);
    }
  }, [links, supplierId]);

  useEffect(() => {
    if (!readyRef.current || !persistReady) return;
    persistLedger({ from, to, supplierId, viewMode });
  }, [from, to, supplierId, viewMode, persistReady, persistLedger]);

  const rangeOk = from <= to;
  const { data: ledger, isLoading, isFetching, error } = useLttpSupplierLedgerQuery(
    { from, to, supplierId },
    { skip: supplierId == null || !rangeOk },
  );

  if (linksLoading) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Đang tải…</p>;
  }
  if (linksError) {
    return <p className="px-3 py-4 text-sm text-destructive">Không tải được danh sách nhà cung cấp.</p>;
  }
  if (links.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Superadmin chưa gắn nhà cung cấp.</p>;
  }

  const days = ledger?.days ?? [];
  const columns = ledger?.recipientColumns ?? [];
  const showLoader = isLoading || isFetching;

  return (
    <div className="flex w-full flex-col gap-3 px-2 py-3 sm:px-3">
      <div className="space-y-1 px-1">
        <h1 className="text-xl font-semibold text-foreground">Sổ công nợ</h1>
        <p className="text-sm text-muted-foreground">
          {ledger ? `Tổng ${formatLedgerMoney(ledger.grandTotal)}` : "Tiền theo ngày và đơn vị nhận."}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 !p-3 sm:!p-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1.5" htmlFor="ledger-from">
              <span className={fieldLabelClass}>Từ ngày</span>
              <input id="ledger-from" type="date" className={fieldControlClass} value={from} onChange={(e) => setFrom(e.target.value || initial.from)} />
            </label>
            <label className="grid gap-1.5" htmlFor="ledger-to">
              <span className={fieldLabelClass}>Đến ngày</span>
              <input id="ledger-to" type="date" className={fieldControlClass} value={to} onChange={(e) => setTo(e.target.value || initial.to)} />
            </label>
            {links.length > 1 ? (
              <label className="grid gap-1.5" htmlFor="ledger-link">
                <span className={fieldLabelClass}>Đơn vị và nhà cung cấp</span>
                <select
                  id="ledger-link"
                  className={fieldControlClass}
                  value={supplierId == null ? "" : String(supplierId)}
                  onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
                  required
                >
                  <option value="">Chọn đơn vị và nhà cung cấp</option>
                  {links.map((link) => (
                    <option key={`${link.level1UnitId}-${link.supplierId}`} value={String(link.supplierId)}>
                      {pairLabel(link)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-1.5">
                <p className={fieldLabelClass}>Đơn vị và nhà cung cấp</p>
                <p className={cn(fieldControlClass, "flex items-center bg-muted/40")}>{pairLabel(links[0])}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium",
                viewMode === "commodity" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground",
              )}
              onClick={() => setViewMode("commodity")}
            >
              Xem theo mặt hàng
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium",
                viewMode === "recipient" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-foreground",
              )}
              onClick={() => setViewMode("recipient")}
            >
              Xem theo đơn vị nhận
            </button>
          </div>

          {!rangeOk ? <p className="text-sm text-destructive">Ngày kết thúc phải sau hoặc trùng ngày bắt đầu.</p> : null}
          {error ? <p className="text-sm text-destructive">{ledgerErrorText(error)}</p> : null}
          {showLoader && supplierId != null ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}
        </CardContent>
      </Card>

      {supplierId != null && rangeOk && !showLoader && !error && days.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Không có công nợ trong khoảng này.</p>
      ) : null}

      {days.length > 0 ? (
        <div className="overflow-visible rounded-xl border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-14 z-40 border-b border-r border-border bg-card px-3 py-2 text-left font-semibold">
                  Ngày
                </th>
                {columns.map((col, index) => (
                  <th
                    key={col.id}
                    className={cn(
                      "sticky top-14 z-30 hidden border-b border-r border-border px-3 py-2 text-center font-semibold md:table-cell",
                      COLUMN_TINTS[index % COLUMN_TINTS.length],
                    )}
                  >
                    {col.name}
                  </th>
                ))}
                <th className="sticky top-14 z-30 hidden border-b border-border bg-muted px-3 py-2 text-center font-semibold md:table-cell">
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const open = openDate === day.date;
                return (
                  <Fragment key={day.date}>
                    <tr
                      className="cursor-pointer"
                      onClick={() => setOpenDate(open ? null : day.date)}
                    >
                      <td className="sticky left-0 z-20 border-r border-t border-border bg-card px-3 py-2 font-medium">
                        {showDate(day.date)}
                      </td>
                      {columns.map((col, index) => (
                        <td
                          key={col.id}
                          className={cn(
                            "hidden border-r border-t border-border px-3 py-2 text-center tabular-nums md:table-cell",
                            COLUMN_TINTS[index % COLUMN_TINTS.length],
                          )}
                        >
                          {formatLedgerMoney(day.byRecipient[col.id] || 0)}
                        </td>
                      ))}
                      <td className="hidden border-t border-border bg-muted px-3 py-2 text-center font-semibold tabular-nums md:table-cell">
                        {formatLedgerMoney(day.total)}
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={columns.length + 2} className="border-t border-border bg-background px-3 py-3">
                          <DayDetail day={day} viewMode={viewMode} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              <tr className="hidden md:table-row">
                <td className="sticky left-0 z-20 border-r border-t border-border bg-card px-3 py-2 font-semibold">Tổng</td>
                {columns.map((col, index) => (
                  <td
                    key={col.id}
                    className={cn(
                      "border-r border-t border-border px-3 py-2 text-center font-semibold tabular-nums",
                      COLUMN_TINTS[index % COLUMN_TINTS.length],
                    )}
                  >
                    {formatLedgerMoney(ledger.columnTotals[col.id] || 0)}
                  </td>
                ))}
                <td className="border-t border-border bg-muted px-3 py-2 text-center font-semibold tabular-nums">
                  {formatLedgerMoney(ledger.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
