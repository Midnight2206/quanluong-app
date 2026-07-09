"use client";

import { Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";
import { formatVnd } from "@/utils/formatVnd";
import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  issueSlipQuantityDisplayCell,
  normalizeIssueSlipPriceKind,
  resolveIssueSlipAppliedUnitPrice,
} from "./lttpIssueSlipPriceKind";

const mobileInputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary";

const mobileQtyDisplayClass =
  "flex h-9 items-center justify-center rounded-lg border border-border bg-muted/35 px-2 text-center text-xs tabular-nums text-muted-foreground";

/**
 * Một dòng mặt hàng dạng thẻ — dùng trong wizard bước «Mặt hàng» trên màn hẹp.
 */
export function LttpIssueSlipMobileLineCard({
  index,
  row,
  commoditySearch,
  suppliers,
  dupRow,
  canWrite,
  quantityDisplay,
  lineTotal,
  onSupplierChange,
  onCodeChange,
  onCodeBlur,
  onCodeKeyDown,
  onQuantityChange,
  onQuantityKeyDown,
  onPriceKindChange,
  onLineNoteChange,
  onRemove,
  qtyInputRef,
  codeInputRef,
}) {
  const kind = normalizeIssueSlipPriceKind(row.priceKind);
  const isMarket = kind === LTTP_ISSUE_SLIP_PRICE_KIND.MARKET;
  const isTgsx = kind === LTTP_ISSUE_SLIP_PRICE_KIND.TGSX;
  const rowDisabled = !canWrite || row.commodityId === "" || !row.commodityId;
  const tgsxDisabled = rowDisabled || row.tgsxPrice == null;
  const applied = resolveIssueSlipAppliedUnitPrice(row);

  return (
    <article
      className={cn(
        "rounded-xl border border-border/70 bg-card/40 p-3 shadow-sm",
        dupRow &&
          "border-l-[3px] border-l-red-600 border-red-500/40 bg-red-500/8 dark:border-l-red-400 dark:bg-red-950/25",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
            dupRow && "text-red-900 dark:text-red-100",
          )}
        >
          Dòng {index + 1}
          {dupRow ? " · Trùng mặt hàng" : ""}
        </p>
        <IconButton
          type="button"
          label="Xóa dòng"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8 shrink-0"
          disabled={!canWrite}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Mặt hàng</span>
          {commoditySearch}
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Đối tác</span>
          <select
            className={cn(
              mobileInputClass,
              dupRow && "border-red-500/90 dark:border-red-400/80",
            )}
            value={
              row.lttpSupplierId === "" || row.lttpSupplierId == null
                ? ""
                : String(row.lttpSupplierId)
            }
            disabled={!canWrite}
            onChange={onSupplierChange}
          >
            <option value="">— Chọn đối tác —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Mã hàng</span>
          <input
            ref={codeInputRef}
            className={cn(
              mobileInputClass,
              "font-mono",
              dupRow && "border-red-500/90 dark:border-red-400/80",
            )}
            value={row.codeDraft}
            disabled={!canWrite}
            onChange={onCodeChange}
            onBlur={onCodeBlur}
            onKeyDown={onCodeKeyDown}
            placeholder="Nhập mã"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground">Mua TT</span>
            <div className={mobileQtyDisplayClass}>
              {issueSlipQuantityDisplayCell({
                priceKind: row.priceKind,
                quantity: row.quantity,
                targetKind: LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
              })}
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <span className="text-muted-foreground">TGSX</span>
            <div className={mobileQtyDisplayClass}>
              {issueSlipQuantityDisplayCell({
                priceKind: row.priceKind,
                quantity: row.quantity,
                targetKind: LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground">Số lượng</span>
            <input
              ref={qtyInputRef}
              type="text"
              inputMode="decimal"
              disabled={rowDisabled}
              className={cn(
                mobileInputClass,
                "text-center tabular-nums",
                dupRow && "border-red-500/90 dark:border-red-400/80",
              )}
              value={quantityDisplay}
              onChange={onQuantityChange}
              onKeyDown={onQuantityKeyDown}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 text-xs",
                rowDisabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                checked={isMarket}
                disabled={rowDisabled}
                onChange={() =>
                  onPriceKindChange(LTTP_ISSUE_SLIP_PRICE_KIND.MARKET)
                }
              />
              Mua thị trường (TT)
            </label>
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 text-xs",
                tgsxDisabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                checked={isTgsx}
                disabled={tgsxDisabled}
                onChange={(e) =>
                  onPriceKindChange(
                    e.target.checked
                      ? LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
                      : LTTP_ISSUE_SLIP_PRICE_KIND.MARKET,
                  )
                }
              />
              TGSX
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/25 px-2 py-2 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Đơn giá</p>
            <p className="font-medium tabular-nums">
              {applied != null ? formatVnd(applied) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Thành tiền</p>
            <p className="font-semibold tabular-nums">{formatVnd(lineTotal)}</p>
          </div>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Ghi chú dòng</span>
          <input
            className={mobileInputClass}
            value={row.lineNote ?? ""}
            disabled={!canWrite}
            onChange={onLineNoteChange}
            placeholder="Tuỳ chọn"
          />
        </label>
      </div>
    </article>
  );
}
