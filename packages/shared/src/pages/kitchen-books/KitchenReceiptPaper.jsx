"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  useGetPaperReceiptQuery,
  useGetPaperStockQuery,
  useSavePaperReceiptMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { useGetLttpCommoditiesQuery, useGetLttpEffectivePricesQuery } from "@/features/lttp/api/lttpApi";
import { apiRequest } from "@/services/apiRequest";
import { notifyError, notifySuccess } from "@/services/notify";
import { monthOf } from "./kitchenPaperBook.js";
import {
  formatMoneyCell,
  formatQtyCell,
  presentReceipt,
  receiptQty,
} from "./kitchenPaperBook.js";
import {
  blankReceiptRow,
  focusPaperCell,
  num,
  receiptCalc,
  receiptFromApi,
  withBlank,
} from "./kitchenPaperForm.js";
import { renderReceiptPage } from "./kitchenPaperHtml.js";
import { KitchenPaperChrome, openPaperPrint } from "./KitchenPaperChrome.jsx";

const QTY_FIELDS = ["trenMuaTt", "trenTgcb", "dvMuaTt", "dvTgcb", "price", "lineNote"];

function errText(error) {
  return error?.data?.message || error?.message || "Không ghi được phiếu.";
}

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(Number(value) || 0));
}

export function KitchenReceiptPaper({
  unitId,
  date,
  onDate,
  canWrite,
  focusCommodityId,
  topUp,
}) {
  const router = useRouter();
  const [rows, setRows] = useState([blankReceiptRow()]);
  const [supplierName, setSupplierName] = useState("");
  const [signers, setSigners] = useState(["", "", "", ""]);
  const [dirty, setDirty] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const seeded = useRef("");
  const topped = useRef("");
  const skip = unitId == null || !date;
  const receipt = useGetPaperReceiptQuery({ unitId, date }, { skip });
  const stock = useGetPaperStockQuery({ unitId, month: date ? monthOf(date) : "" }, { skip });
  const commoditiesQuery = useGetLttpCommoditiesQuery(unitId, { skip });
  const prices = useGetLttpEffectivePricesQuery(
    unitId != null && date ? { unitId, date } : undefined,
    { skip },
  );
  const [save, saveState] = useSavePaperReceiptMutation();
  const commodities = Array.isArray(commoditiesQuery.data) ? commoditiesQuery.data : [];
  const priceById = useMemo(() => {
    const map = new Map();
    for (const item of prices.data?.items || []) map.set(Number(item.commodityId), item);
    return map;
  }, [prices.data]);

  useEffect(() => {
    const slip = receipt.data;
    if (!slip || dirty) return;
    const key = `${unitId}:${date}:${slip.lines?.length}:${slip.total}`;
    if (seeded.current === key) return;
    seeded.current = key;
    setRows(withBlank((slip.lines || []).map(receiptFromApi), blankReceiptRow));
    setSupplierName(slip.supplierName || "");
    setSigners(slip.signers || ["", "", "", ""]);
  }, [receipt.data, dirty, unitId, date]);

  useEffect(() => {
    if (!focusCommodityId) return;
    const row = document.getElementById(`paper-row-${focusCommodityId}`);
    row?.scrollIntoView({ block: "center" });
  }, [focusCommodityId, rows]);

  useEffect(() => {
    const amount = num(topUp);
    if (!focusCommodityId || !amount || topped.current === `${date}:${focusCommodityId}`) return;
    topped.current = `${date}:${focusCommodityId}`;
    setRows((prev) => {
      const hit = prev.find((row) => String(row.commodityId) === String(focusCommodityId));
      if (!hit) {
        const commodity = commodities.find((item) => String(item.id) === String(focusCommodityId));
        const blank = blankReceiptRow();
        const added = {
          ...blank,
          commodityId: Number(focusCommodityId),
          name: commodity?.name || "",
          code: commodity?.code || "",
          uom: commodity?.measureUnit || "",
          dvMuaTt: String(amount),
          price: priceById.get(Number(focusCommodityId))?.unitPrice ?? "",
        };
        return [added, ...prev];
      }
      return prev.map((row) => (
        String(row.commodityId) === String(focusCommodityId)
          ? { ...row, dvMuaTt: String(num(row.dvMuaTt) + amount) }
          : row
      ));
    });
    setDirty(true);
  }, [focusCommodityId, topUp, date, commodities, priceById]);

  const view = presentReceipt(rows.filter((row) => row.commodityId).map(receiptCalc));
  const stockDay = stock.data?.days?.find((day) => day.date === date);
  const carryRows = useMemo(() => {
    const map = new Map((stockDay?.lines || []).map((line) => [String(line.commodityId), line]));
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      if (!row.commodityId) continue;
      const id = String(row.commodityId);
      seen.add(id);
      const saved = map.get(id);
      const inn = receiptQty(receiptCalc(row));
      const opening = Number(saved?.opening || 0);
      const outQty = Number(saved?.outQty || 0);
      const close = Math.round((opening + inn - outQty) * 10000) / 10000;
      out.push({ ...row, opening, outQty, close, price: num(row.price) || Number(saved?.price || 0) });
    }
    for (const line of stockDay?.lines || []) {
      if (seen.has(String(line.commodityId))) continue;
      if (!line.opening && !line.outQty) continue;
      out.push({
        commodityId: line.commodityId,
        name: line.name,
        uom: line.uom,
        opening: line.opening,
        outQty: line.outQty,
        close: line.close,
        price: line.price,
      });
    }
    return out;
  }, [rows, stockDay]);
  const carryMoney = carryRows.reduce((sum, row) => sum + Math.round(row.close * (row.price || 0)), 0);

  function patch(key, field, value) {
    setDirty(true);
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function pickCommodity(key, commodity) {
    setDirty(true);
    setRows((prev) => {
      const next = prev.map((row) => {
        if (row.key !== key) return row;
        const price = row.price || priceById.get(Number(commodity.id))?.unitPrice || "";
        return {
          ...row,
          commodityId: commodity.id,
          code: commodity.code || "",
          name: commodity.name || "",
          uom: commodity.measureUnit || "",
          price: price === "" ? "" : String(price),
        };
      });
      return withBlank(next, blankReceiptRow);
    });
  }

  function topUpRow(commodityId, amount) {
    setDirty(true);
    setRows((prev) => prev.map((row) => (
      String(row.commodityId) === String(commodityId)
        ? { ...row, dvMuaTt: String(num(row.dvMuaTt) + amount) }
        : row
    )));
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        unitId,
        date,
        supplierName,
        signers,
        lines: rows.filter((row) => row.commodityId).map((row) => ({
          commodityId: Number(row.commodityId),
          trenMuaTt: num(row.trenMuaTt),
          trenTgcb: num(row.trenTgcb),
          dvMuaTt: num(row.dvMuaTt),
          dvTgcb: num(row.dvTgcb),
          price: num(row.price),
          lineNote: row.lineNote || "",
        })),
      });
      setDirty(false);
      notifySuccess("Đã ghi phiếu nhập");
    } catch (error) {
      notifyError(errText(error));
    }
  }

  function changeDate(next) {
    if (dirty && !window.confirm("Phiếu đang sửa chưa ghi. Đổi ngày và bỏ các sửa này?")) return;
    setDirty(false);
    seeded.current = "";
    onDate(next);
  }

  function pageModel(slip) {
    const lines = (slip?.lines || rows.filter((row) => row.commodityId).map(receiptCalc));
    const shown = presentReceipt(lines.map((line) => ("trenMuaTt" in line ? line : receiptCalc(line))));
    return {
      date: slip?.date || date,
      header: slip?.header || receipt.data?.header,
      supplierName: slip?.supplierName ?? supplierName,
      signers: slip?.signers || signers,
      lines: shown.rows.filter((row) => row.tt),
      total: shown.total,
      itemCount: shown.itemCount,
      words: shown.words,
    };
  }

  function printDay() {
    if (!openPaperPrint([renderReceiptPage(pageModel())])) notifyError("Trình duyệt đang chặn cửa sổ in.");
  }

  async function printMonth() {
    try {
      const data = await apiRequest({
        url: "/kitchen-books/paper/receipt",
        method: "get",
        params: { unitId, month: monthOf(date) },
      });
      const pages = (data?.days || []).map((day) => renderReceiptPage({
        ...day,
        lines: presentReceipt(day.lines || []).rows.filter((row) => row.tt),
        total: day.total,
        itemCount: day.itemCount,
        words: day.words,
      }));
      if (!openPaperPrint(pages)) notifyError("Trình duyệt đang chặn cửa sổ in.");
    } catch (error) {
      notifyError(errText(error));
    }
  }

  const header = receipt.data?.header || {};
  const parts = date ? date.split("-") : ["", "", ""];

  return (
    <KitchenPaperChrome
      date={date}
      onDate={changeDate}
      markers={stock.data?.markers}
      onPrintDay={printDay}
      onPrintMonth={printMonth}
      busy={saveState.isPending}
      extra={(
        <>
          <Button type="button" className="paper-balance-toggle" onClick={() => setSideOpen(true)}>Tồn chuyển hôm sau</Button>
          <Button type="button" className="h-11 px-3" disabled={!canWrite || saveState.isPending || unitId == null} onClick={onSave}>
            {saveState.isPending ? "Đang ghi…" : "Lưu phiếu"}
          </Button>
        </>
      )}
    >
      {receipt.isLoading ? <p className="text-sm text-muted-foreground">Đang tải phiếu nhập…</p> : null}
      {receipt.error ? <p className="text-sm text-destructive">{errText(receipt.error)}</p> : null}
      {dirty ? <p className="no-print text-xs text-muted-foreground">Sửa này chưa ghi. Bấm Lưu phiếu để ghi thẳng vào cơ sở dữ liệu.</p> : null}
      <div className="paper-stage">
        <div className="kitchen-paper-scroll">
          <article className="ledger-paper kitchen-paper paper-page" data-paper-page="1">
            <header className="kpp-head">
              <div>
                <div>{header.parentName}</div>
                <div><strong>{header.unitName}</strong></div>
                <div>{header.warehouseName}</div>
              </div>
              <div className="center"><h1 className="kpp-title">PHIẾU NHẬP KHO</h1></div>
              <div className="right">
                <div>{header.formCode || "Mẫu 26: PNX-TMKH/QN25"}</div>
                <div>Số: {parts[2]}</div>
              </div>
            </header>
            <p className="kpp-sub">Có giá trị đến ngày {parts[2]} tháng {parts[1]} năm {parts[0]}</p>
            <p className="kpp-sub">
              Nhập hàng của đồng chí{" "}
              <input className="w-40 border-b border-foreground/40 bg-transparent" aria-label="Tên người giao hàng" value={supplierName} disabled={!canWrite} onChange={(event) => { setDirty(true); setSupplierName(event.target.value); }} />
              {" "}theo dự trù LTTP ngày {parts[2]} tháng {parts[1]} năm {parts[0]}
            </p>
            <p className="kpp-sub">Hàng do bộ phận tiếp phẩm của Trung đoàn vận chuyển</p>
            <table className="kpp" onKeyDown={(event) => focusPaperCell(event, rows.length)}>
              <thead>
                <tr>
                  <th rowSpan={2}>TT</th><th rowSpan={2}>MA</th>
                  <th rowSpan={2}>TÊN, QUI CÁCH VẬT TƯ, SẢN PHẨM</th>
                  <th rowSpan={2}>ĐVT</th>
                  <th colSpan={2}>TRÊN BẢO ĐẢM</th>
                  <th colSpan={2}>ĐƠN VỊ BẢO ĐẢM</th>
                  <th rowSpan={2}>Cộng</th><th rowSpan={2}>Giá lẻ</th><th rowSpan={2}>Thành tiền</th><th rowSpan={2}>Ghi chú</th>
                </tr>
                <tr><th>Mua TT</th><th>TG-CB</th><th>Mua TT</th><th>TG-CB</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const calc = presentReceipt([receiptCalc(row)]).rows[0];
                  const focused = focusCommodityId && String(row.commodityId) === String(focusCommodityId);
                  return (
                    <tr key={row.key} id={row.commodityId ? `paper-row-${row.commodityId}` : undefined} className={focused ? "is-focus" : undefined}>
                      <td className="num">{calc.tt || ""}</td>
                      <td className="num">{row.code}</td>
                      <td data-cell={`${index}-0`} data-cols="6">
                        <input
                          className="name"
                          aria-label="Tên mặt hàng"
                          list="paper-commodities"
                          value={row.name}
                          disabled={!canWrite}
                          onChange={(event) => {
                            const text = event.target.value;
                            const hit = commodities.find((item) => item.name === text || item.code === text);
                            if (hit) pickCommodity(row.key, hit);
                            else patch(row.key, "name", text);
                          }}
                        />
                      </td>
                      <td className="num">{row.uom}</td>
                      {QTY_FIELDS.slice(0, 4).map((field, col) => (
                        <td key={field} className="num" data-cell={`${index}-${col + 1}`} data-cols="6">
                          <input aria-label={field} inputMode="decimal" value={row[field]} disabled={!canWrite} onChange={(event) => patch(row.key, field, event.target.value)} />
                        </td>
                      ))}
                      <td className="num">{formatQtyCell(calc.qty)}</td>
                      <td className="num" data-cell={`${index}-5`} data-cols="6">
                        <input aria-label="Giá lẻ" inputMode="decimal" value={row.price} disabled={!canWrite} onChange={(event) => patch(row.key, "price", event.target.value)} />
                      </td>
                      <td className="num">{formatMoneyCell(calc.amount)}</td>
                      <td>
                        <input aria-label="Ghi chú" value={row.lineNote} disabled={!canWrite} onChange={(event) => patch(row.key, "lineNote", event.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={10}>Cộng</td><td className="num">{formatMoneyCell(view.total)}</td><td /></tr>
              </tfoot>
            </table>
            <datalist id="paper-commodities">
              {commodities.map((item) => (
                <option key={item.id} value={item.name}>{item.code} · {item.measureUnit}</option>
              ))}
            </datalist>
            <p>Tổng số mặt hàng: {view.itemCount} mặt hàng.</p>
            <p><strong>Tổng số tiền (Viết bằng chữ): {view.words}</strong></p>
            <div className="kpp-meta">
              <span>Ngày giao: {parts[2]}/{parts[1]}/{parts[0]}</span>
              <span>Ngày nhận: {parts[2]}/{parts[1]}/{parts[0]}</span>
            </div>
            <div className="kpp-sign">
              {["NGƯỜI LẬP", "NGƯỜI GIAO", "NGƯỜI NHẬN", "NGƯỜI DUYỆT"].map((label, index) => (
                <div key={label}>
                  <strong>{label}</strong>
                  <input aria-label={label} value={signers[index] || ""} disabled={!canWrite} onChange={(event) => {
                    const next = [...signers];
                    next[index] = event.target.value;
                    setSigners(next);
                    setDirty(true);
                  }} />
                </div>
              ))}
            </div>
          </article>
        </div>
        <aside className={sideOpen ? "paper-sidebar is-open no-print" : "paper-sidebar no-print"} data-local-scroll="true" aria-label="Tồn kho chuyển hôm sau">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tồn kho chuyển hôm sau</h2>
            <Button type="button" variant="ghost" className="paper-balance-toggle" onClick={() => setSideOpen(false)}>Đóng</Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Tồn đầu + nhập phiếu này − xuất cùng ngày. Không in vào PDF.</p>
          <ul className="space-y-2">
            {carryRows.map((row) => (
              <li key={row.commodityId} className={row.close < 0 ? "minus" : undefined}>
                <div>{row.name} · {formatQtyCell(row.close) || "0"} {row.uom}</div>
                {row.close < 0 ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span>Âm kho −{formatQtyCell(Math.abs(row.close))} {row.uom}</span>
                    <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={!canWrite} onClick={() => topUpRow(row.commodityId, Math.abs(row.close))}>Nhập bù</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-semibold">Tổng tiền tồn: {money(carryMoney)} đ</p>
          <Button type="button" variant="ghost" className="mt-2 h-11 px-2 text-xs" onClick={() => router.push(`/so-sach-bep-an?tab=so-theo-doi-lttp&date=${date}&ngay=${date}`)}>Mở sổ theo dõi</Button>
        </aside>
      </div>
    </KitchenPaperChrome>
  );
}
