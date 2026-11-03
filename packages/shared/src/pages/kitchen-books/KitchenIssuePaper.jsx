"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  useGetKitchenLedgerQuery,
  useGetPaperIssueQuery,
  useGetPaperStockQuery,
  useSavePaperIssueMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { useGetLttpCommoditiesQuery, useGetLttpEffectivePricesQuery } from "@/features/lttp/api/lttpApi";
import { apiRequest } from "@/services/apiRequest";
import { notifyError, notifySuccess } from "@/services/notify";
import {
  ISSUE_COL_WIDTHS,
  cktcBalanceView,
  columnPercents,
  formatMoneyCell,
  formatQtyCell,
  issueQty,
  monthOf,
  presentIssue,
} from "./kitchenPaperBook.js";
import {
  blankIssueRow,
  focusPaperCell,
  issueCalc,
  issueFromApi,
  num,
  withBlank,
} from "./kitchenPaperForm.js";
import { renderIssuePage } from "./kitchenPaperHtml.js";
import { KitchenPaperChrome, openPaperPrint } from "./KitchenPaperChrome.jsx";

function errText(error) {
  return error?.data?.message || error?.message || "Không ghi được phiếu.";
}

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(Number(value) || 0));
}

export function KitchenIssuePaper({ unitId, date, onDate, canWrite, focusCommodityId }) {
  const router = useRouter();
  const [rows, setRows] = useState([blankIssueRow()]);
  const [party, setParty] = useState({ recipientName: "", departmentName: "", reason: "", receivePlace: "" });
  const [signers, setSigners] = useState(["", "", "", ""]);
  const [dirty, setDirty] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const seeded = useRef("");
  const skip = unitId == null || !date;
  const issue = useGetPaperIssueQuery({ unitId, date }, { skip });
  const stock = useGetPaperStockQuery({ unitId, month: date ? monthOf(date) : "" }, { skip });
  const ledger = useGetKitchenLedgerQuery({ unitId, date }, { skip });
  const commoditiesQuery = useGetLttpCommoditiesQuery(unitId, { skip });
  const prices = useGetLttpEffectivePricesQuery(unitId != null && date ? { unitId, date } : undefined, { skip });
  const [save, saveState] = useSavePaperIssueMutation();
  const commodities = Array.isArray(commoditiesQuery.data) ? commoditiesQuery.data : [];
  const priceById = useMemo(() => {
    const map = new Map();
    for (const item of prices.data?.items || []) map.set(Number(item.commodityId), item);
    return map;
  }, [prices.data]);

  useEffect(() => {
    const slip = issue.data;
    if (!slip || dirty) return;
    const key = `${unitId}:${date}:${slip.lines?.length}:${slip.total}`;
    if (seeded.current === key) return;
    seeded.current = key;
    setRows(withBlank((slip.lines || []).map(issueFromApi), blankIssueRow));
    setParty({
      recipientName: slip.recipientName || "",
      departmentName: slip.departmentName || "",
      reason: slip.reason || "",
      receivePlace: slip.receivePlace || "",
    });
    setSigners(slip.signers || ["", "", "", ""]);
  }, [issue.data, dirty, unitId, date]);

  useEffect(() => {
    if (!focusCommodityId) return;
    document.getElementById(`paper-row-${focusCommodityId}`)?.scrollIntoView({ block: "center" });
  }, [focusCommodityId, rows]);

  const view = presentIssue(rows.filter((row) => row.commodityId).map(issueCalc));
  const balance = cktcBalanceView({ finance: ledger.data?.finance, issueTotal: view.total });
  const stockDay = stock.data?.days?.find((day) => day.date === date);
  const stockById = useMemo(
    () => new Map((stockDay?.lines || []).map((line) => [String(line.commodityId), line])),
    [stockDay],
  );

  function patch(key, field, value) {
    setDirty(true);
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function pickCommodity(key, commodity) {
    const onHand = stockById.has(String(commodity.id));
    setDirty(true);
    setRows((prev) => withBlank(prev.map((row) => {
      if (row.key !== key) return row;
      return {
        ...row,
        commodityId: commodity.id,
        code: commodity.code || "",
        name: commodity.name || "",
        uom: commodity.measureUnit || "",
        price: row.price || String(priceById.get(Number(commodity.id))?.unitPrice ?? ""),
        warnStock: !onHand,
      };
    }), blankIssueRow));
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        unitId,
        date,
        ...party,
        signers,
        lines: rows.filter((row) => row.commodityId).map((row) => ({
          commodityId: Number(row.commodityId),
          sang: num(row.sang),
          trua: num(row.trua),
          chieu: num(row.chieu),
          price: num(row.price),
          lineNote: row.lineNote || "",
        })),
      });
      setDirty(false);
      notifySuccess("Đã ghi phiếu xuất");
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

  function printDay() {
    const shown = presentIssue(rows.filter((row) => row.commodityId).map(issueCalc));
    const ok = openPaperPrint([renderIssuePage({
      date,
      header: issue.data?.header,
      party,
      signers,
      lines: shown.rows.filter((row) => row.tt),
      total: shown.total,
      itemCount: shown.itemCount,
      words: shown.words,
    })]);
    if (!ok) notifyError("Trình duyệt đang chặn cửa sổ in.");
  }

  async function printMonth() {
    try {
      const data = await apiRequest({
        url: "/kitchen-books/paper/issue",
        method: "get",
        params: { unitId, month: monthOf(date) },
      });
      const pages = (data?.days || []).map((day) => renderIssuePage({
        date: day.date,
        header: day.header,
        party: day,
        signers: day.signers,
        lines: presentIssue(day.lines || []).rows.filter((row) => row.tt),
        total: day.total,
        itemCount: day.itemCount,
        words: day.words,
      }));
      if (!openPaperPrint(pages)) notifyError("Trình duyệt đang chặn cửa sổ in.");
    } catch (error) {
      notifyError(errText(error));
    }
  }

  const header = issue.data?.header || {};
  const parts = (date || "").split("-");
  const fields = ["sang", "trua", "chieu"];

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
          <Button type="button" className="paper-balance-toggle" onClick={() => setSideOpen(true)}>Cân đối thu chi</Button>
          <Button type="button" className="h-11 px-3" disabled={!canWrite || saveState.isPending || unitId == null} onClick={onSave}>
            {saveState.isPending ? "Đang ghi…" : "Lưu phiếu"}
          </Button>
        </>
      )}
    >
      {issue.isLoading ? <p className="text-sm text-muted-foreground">Đang tải phiếu xuất…</p> : null}
      {dirty ? <p className="no-print text-xs text-muted-foreground">Sửa này chưa ghi. Bấm Lưu phiếu để ghi thẳng vào cơ sở dữ liệu.</p> : null}
      <div className="paper-stage">
        <div className="kitchen-paper-scroll">
          <article className="ledger-paper kitchen-paper paper-page" data-paper-page="1">
            <header className="kpp-head">
              <div>
                <div>{header.parentName}</div>
                <div><strong>{header.unitName}</strong></div>
              </div>
              <div className="center"><h1 className="kpp-title">PHIẾU XUẤT KHO</h1></div>
              <div className="right">
                <div>Quyển số: {parts[1]}</div>
                <div>Số: {parts[2]}</div>
              </div>
            </header>
            <p className="kpp-sub">Có giá trị đến ngày {parts[2]} tháng {parts[1]} năm {parts[0]}</p>
            <p className="kpp-sub">Họ, tên người nhận: <input aria-label="Người nhận" value={party.recipientName} disabled={!canWrite} onChange={(event) => { setDirty(true); setParty({ ...party, recipientName: event.target.value }); }} /></p>
            <p className="kpp-sub">Đơn vị (Bộ phận): <input aria-label="Đơn vị nhận" value={party.departmentName} disabled={!canWrite} onChange={(event) => { setDirty(true); setParty({ ...party, departmentName: event.target.value }); }} /></p>
            <p className="kpp-sub">Lý do sử dụng: <input aria-label="Lý do sử dụng" value={party.reason} disabled={!canWrite} onChange={(event) => { setDirty(true); setParty({ ...party, reason: event.target.value }); }} /></p>
            <p className="kpp-sub">Nhận tại kho: <input aria-label="Nhận tại kho" value={party.receivePlace} disabled={!canWrite} onChange={(event) => { setDirty(true); setParty({ ...party, receivePlace: event.target.value }); }} /></p>
            <table className="kpp" onKeyDown={(event) => focusPaperCell(event, rows.length)}>
              <colgroup>
                {columnPercents(ISSUE_COL_WIDTHS).map((width, index) => (
                  <col key={index} style={{ width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>TT</th><th rowSpan={2}>MA</th>
                  <th rowSpan={2}>TÊN, QUI CÁCH VẬT TƯ, SẢN PHẨM</th>
                  <th rowSpan={2}>ĐVT</th>
                  <th colSpan={4}>SỐ LƯỢNG</th>
                  <th rowSpan={2}>Giá lẻ</th><th rowSpan={2}>Thành tiền</th><th rowSpan={2}>Ghi chú</th>
                </tr>
                <tr><th>Sáng</th><th>Trưa</th><th>Chiều</th><th>Tổng cộng</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const calc = view.rows.find((item) => item.key === row.key) || { tt: 0, qty: 0, amount: 0 };
                  const saved = stockById.get(String(row.commodityId));
                  const available = Number(saved?.opening || 0) + Number(saved?.inQty || 0);
                  const short = calc.qty > available + 1e-9;
                  const missing = short ? Math.round((calc.qty - available) * 10000) / 10000 : 0;
                  return (
                    <tr key={row.key} id={row.commodityId ? `paper-row-${row.commodityId}` : undefined} className={String(row.commodityId) === String(focusCommodityId) ? "is-focus" : undefined}>
                      <td className="num">{calc.tt || ""}</td>
                      <td className="num">{row.code}</td>
                      <td data-cell={`${index}-0`} data-cols="5">
                        <input
                          aria-label="Tên mặt hàng"
                          list="paper-issue-commodities"
                          value={row.name}
                          disabled={!canWrite}
                          onChange={(event) => {
                            const text = event.target.value;
                            const hit = commodities.find((item) => item.name === text || item.code === text);
                            if (hit) pickCommodity(row.key, hit);
                            else patch(row.key, "name", text);
                          }}
                        />
                        {row.warnStock ? <div className="text-[10px] text-destructive">Chưa có tồn hoặc nhập trong ngày</div> : null}
                      </td>
                      <td className="num">{row.uom}</td>
                      {fields.map((field, col) => (
                        <td key={field} className="num" data-cell={`${index}-${col + 1}`} data-cols="5">
                          <input aria-label={field} inputMode="decimal" value={row[field]} disabled={!canWrite} onChange={(event) => patch(row.key, field, event.target.value)} />
                        </td>
                      ))}
                      <td className={short ? "num bad" : "num"} title={short ? `Thiếu ${missing} ${row.uom}` : undefined}>
                        {formatQtyCell(issueQty(issueCalc(row)))}
                        {short ? (
                          <button type="button" className="block text-[10px] underline" onClick={() => router.push(`/so-sach-bep-an?tab=phieu-nhap-kho&date=${date}&ngay=${date}&mathang=${row.commodityId}`)}>Về phiếu nhập</button>
                        ) : null}
                      </td>
                      <td className="num" data-cell={`${index}-4`} data-cols="5">
                        <input aria-label="Giá lẻ" inputMode="decimal" value={row.price} disabled={!canWrite} onChange={(event) => patch(row.key, "price", event.target.value)} />
                      </td>
                      <td className="num">{formatMoneyCell(calc.amount)}</td>
                      <td><input aria-label="Ghi chú" value={row.lineNote} disabled={!canWrite} onChange={(event) => patch(row.key, "lineNote", event.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={9}>Cộng</td><td className="num">{formatMoneyCell(view.total)}</td><td /></tr>
              </tfoot>
            </table>
            <datalist id="paper-issue-commodities">
              {commodities.map((item) => <option key={item.id} value={item.name}>{item.measureUnit}</option>)}
            </datalist>
            <p>Tổng số mặt hàng: {view.itemCount} mặt hàng.</p>
            <p><strong>Tổng số tiền (Viết bằng chữ): {view.words}</strong></p>
            <div className="kpp-meta">
              <span>Ngày giao: {parts[2]}/{parts[1]}/{parts[0]}</span>
              <span>Ngày nhận: {parts[2]}/{parts[1]}/{parts[0]}</span>
            </div>
            <div className="kpp-sign">
              {["NGƯỜI VIẾT PHIẾU", "NGƯỜI NHẬN", "THỦ KHO", "NGƯỜI DUYỆT"].map((label, index) => (
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
        <aside className={sideOpen ? "paper-sidebar is-open no-print" : "paper-sidebar no-print"} data-local-scroll="true" aria-label="Cân đối thu chi">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cân đối thu chi</h2>
            <Button type="button" variant="ghost" className="paper-balance-toggle" onClick={() => setSideOpen(false)}>Đóng</Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Đọc công khai tài chính của sổ nhập xuất. Không in và không lưu vào phiếu.</p>
          {ledger.isLoading ? <p>Đang đọc công khai tài chính…</p> : null}
          {!ledger.isLoading && !ledger.data?.finance ? <p>Chưa có công khai tài chính cho ngày này.</p> : null}
          {ledger.data?.finance ? (
            <dl className="space-y-1">
              <div>Tiền ăn: {money(balance.mealIncome)} đ</div>
              {balance.anThem ? <div>Ăn thêm: {money(balance.anThem)} đ</div> : null}
              {balance.truyLinh ? <div>Truy lĩnh: {money(balance.truyLinh)} đ</div> : null}
              {balance.thuKhach ? <div>Thu khách: {money(balance.thuKhach)} đ</div> : null}
              {balance.riceSubsidy ? <div>Trợ giá gạo: {money(balance.riceSubsidy)} đ</div> : null}
              <div>Thu trong ngày: {money(balance.thu)} đ</div>
              <div>Chi trong ngày: {money(balance.chi)} đ</div>
              <div className={balance.diff >= 0 ? "plus" : "minus"}>
                Chênh lệch ngày: {money(balance.diff)} đ {balance.diff >= 0 ? "(thừa)" : "(bội chi)"}
              </div>
              <div className={balance.carried >= 0 ? "plus" : "minus"}>
                Lũy kế từ đầu tháng: {money(balance.carried)} đ
              </div>
            </dl>
          ) : null}
        </aside>
      </div>
    </KitchenPaperChrome>
  );
}
