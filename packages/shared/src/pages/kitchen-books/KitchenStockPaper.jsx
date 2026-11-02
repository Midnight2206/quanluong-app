"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useGetPaperStockQuery } from "@/features/kitchen-books/api/kitchenBooksApi";
import { useGetLttpCommoditiesQuery } from "@/features/lttp/api/lttpApi";
import { KitchenOpeningDialog } from "./KitchenOpeningDialog.jsx";
import { apiRequest } from "@/services/apiRequest";
import { notifyError } from "@/services/notify";
import {
  daysOfMonth,
  formatQtyCell,
  monthOf,
  negativesOnDate,
} from "./kitchenPaperBook.js";
import { renderStockPage } from "./kitchenPaperHtml.js";
import { KitchenPaperChrome, openPaperPrint } from "./KitchenPaperChrome.jsx";

function errText(error) {
  return error?.data?.message || error?.message || "Không tải được sổ.";
}

export function KitchenStockPaper({ unitId, date, onDate }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [openingOpen, setOpeningOpen] = useState(false);
  const skip = unitId == null || !date;
  const stock = useGetPaperStockQuery({ unitId, month: date ? monthOf(date) : "" }, { skip });
  const commoditiesQuery = useGetLttpCommoditiesQuery(unitId, { skip });
  const commodities = Array.isArray(commoditiesQuery.data) ? commoditiesQuery.data : [];
  useEffect(() => {
    if (stock.data?.canDeclareOpening) setOpeningOpen(true);
  }, [stock.data?.canDeclareOpening, unitId]);
  const day = stock.data?.days?.find((row) => row.date === date);
  const runs = useMemo(
    () => negativesOnDate(stock.data?.negatives || [], date),
    [stock.data, date],
  );
  const selected = runs.find((run) => String(run.commodityId) === choice) || runs[0];
  const parts = (date || "").split("-");

  function openReceipt(run) {
    if (!run) return;
    const params = new URLSearchParams({
      tab: "phieu-nhap-kho",
      date: run.startDate,
      ngay: run.startDate,
      mathang: String(run.commodityId),
      bu: String(run.suggestQty),
    });
    router.push(`/so-sach-bep-an?${params.toString()}`);
  }

  function openSlip(tab, commodityId) {
    const params = new URLSearchParams({
      tab,
      date,
      ngay: date,
      mathang: String(commodityId),
    });
    router.push(`/so-sach-bep-an?${params.toString()}`);
  }

  function printDay() {
    const ok = openPaperPrint([renderStockPage({ date, lines: day?.lines || [] })]);
    if (!ok) notifyError("Trình duyệt đang chặn cửa sổ in.");
  }

  async function printMonth() {
    try {
      const data = await apiRequest({
        url: "/kitchen-books/paper/stock",
        method: "get",
        params: { unitId, month: monthOf(date) },
      });
      const byDate = new Map((data?.days || []).map((row) => [row.date, row]));
      const pages = daysOfMonth(monthOf(date)).map((dayKey) => renderStockPage({
        date: dayKey,
        lines: byDate.get(dayKey)?.lines || [],
      }));
      if (!openPaperPrint(pages)) notifyError("Trình duyệt đang chặn cửa sổ in.");
    } catch (error) {
      notifyError(errText(error));
    }
  }

  return (
    <KitchenPaperChrome
      date={date}
      onDate={onDate}
      markers={stock.data?.markers}
      onPrintDay={printDay}
      onPrintMonth={printMonth}
    >
      {stock.isError ? <p className="text-sm text-destructive">{errText(stock.error)}</p> : null}
      {stock.data?.canDeclareOpening ? (
        <Button type="button" variant="secondary" className="no-print h-11 px-3" onClick={() => setOpeningOpen(true)}>Khai báo tồn đầu</Button>
      ) : null}
      <KitchenOpeningDialog
        unitId={unitId}
        commodities={commodities}
        lines={stock.data?.openingLines}
        open={Boolean(stock.data?.canDeclareOpening) && openingOpen}
        onClose={() => setOpeningOpen(false)}
      />
      {runs.length ? (
        <div className="no-print rounded border border-destructive/40 bg-destructive/10 p-2 text-sm">
          <p>Ngày này có {runs.length} mặt hàng âm kho.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="min-w-0 max-lg:w-full">
              Mặt hàng
              <select className="ml-2 h-11 max-w-full max-lg:mt-1 max-lg:ml-0 max-lg:block max-lg:w-full" value={selected ? String(selected.commodityId) : ""} onChange={(event) => setChoice(event.target.value)}>
                {runs.map((run) => (
                  <option key={run.commodityId} value={run.commodityId}>
                    {run.name} — bắt đầu {run.startDate.split("-").reverse().join("/")} — nhập bù {run.suggestQty} {run.uom}
                  </option>
                ))}
              </select>
              {selected ? (
                <span className="mt-1 block">Bắt đầu âm {selected.startDate.split("-").reverse().join("/")}, nhập bù {selected.suggestQty} {selected.uom}.</span>
              ) : null}
            </label>
            <Button type="button" className="h-11 px-3" onClick={() => openReceipt(selected)}>
              Về phiếu nhập ngày bắt đầu âm
            </Button>
          </div>
        </div>
      ) : null}
      <div className="kitchen-paper-scroll">
        <article className="ledger-paper kitchen-paper paper-page" data-paper-page="1">
          <p className="kpp-date">Ngày {parts[2]} tháng {parts[1]} năm {parts[0]}</p>
          <table className="kpp" aria-label="Sổ theo dõi LTTP">
            <thead>
              <tr>
                <th colSpan={2}>SỐ PHIẾU</th>
                <th rowSpan={2}>DANH MỤC</th>
                <th rowSpan={2}>ĐVT</th>
                <th rowSpan={2}>Tồn ngày trước chuyển sang</th>
                <th rowSpan={2}>Nhập</th>
                <th rowSpan={2}>Xuất</th>
                <th rowSpan={2}>Tồn</th>
                <th rowSpan={2}>GHI CHÚ</th>
              </tr>
              <tr><th>NHẬP</th><th>XUẤT</th></tr>
            </thead>
            <tbody>
              {(day?.lines || []).map((line) => (
                <tr key={line.commodityId} id={`paper-row-${line.commodityId}`} className={line.negative ? "minus" : undefined}>
                  <td className="num">{line.slipIn}</td>
                  <td className="num">{line.slipOut}</td>
                  <td>{line.name}</td>
                  <td className="num">{line.uom}</td>
                  <td className="num">{formatQtyCell(line.opening)}</td>
                  <td className="num">
                    <button type="button" className="underline" onClick={() => openSlip("phieu-nhap-kho", line.commodityId)}>{formatQtyCell(line.inQty) || "—"}</button>
                  </td>
                  <td className="num">
                    <button type="button" className="underline" onClick={() => openSlip("phieu-xuat-kho", line.commodityId)}>{formatQtyCell(line.outQty) || "—"}</button>
                  </td>
                  <td className={line.negative ? "num bad" : "num"}>{formatQtyCell(line.close)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
          {!day?.lines?.length && !stock.isLoading ? <p className="mt-2 text-sm">Ngày này chưa có nhập, xuất hoặc tồn.</p> : null}
        </article>
      </div>
    </KitchenPaperChrome>
  );
}
