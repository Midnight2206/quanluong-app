import { useMemo } from "react";
import { vndToVietnameseDocumentLine } from "@/utils/vndVietnameseText";
import { formatVnIntDot, formatVnQtyComma } from "@/utils/printNumberFormat";
import { formatIssueSlipPrintDate } from "@/utils/printIssueDate";

const DEFAULT_FONT = "'Times New Roman', Times, serif";

const printBlockClass = "lttp-isd-print text-black antialiased [print-color-adjust:exact] [color-scheme:light]";

/**
 * Một khổ phiếu in (API `mapIssueSlip` / xem trước từ tab nhập).
 *
 * Bố cục (theo mẫu hành chính):
 * - Header 3 cột **30% | 40% | 30%**: trái — đơn vị (dòng 1–2 + gạch); giữa — khoảng trống; phải — mẫu, quyển, số. Trong **mỗi cột**, nội dung **căn giữa theo chiều ngang** và cả hàng header **căn giữa theo chiều dọc** (`flex` + `items-center`).
 * - **PHIẾU XUẤT KHO** (và bảng chính): **căn giữa** trang — tách khỏi header 3 cột.
 * - Dòng 2: gạch chân dài **bằng ½ chiều rộng chữ** (trong cột trái).
 * - Bảng: cột tên mặt hàng **trái**; cột **Giá**, **Thành tiền** **phải**; **STT** (số 1,2,3,…), mã, ĐV, số lượng, ghi chú **giữa**. Chỉ các dòng có dữ liệu, không dòng hầu.
 * - Tổng bằng chữ, khối chữ ký: nhãn + tên dưới cùng **in đậm** (tên ký rõ nét khi in).
 */
export function LttpIssueSlipPrintDocument({ slip, breakAfter = false, fontFamily, fontSizePt = 12 }) {
  const dataRows = slip?.lines ?? [];
  const font = fontFamily || DEFAULT_FONT;
  const formTotal = useMemo(
    () => dataRows.reduce((s, l) => s + (Number(l.amount) || 0), 0),
    [dataRows],
  );
  const totalInWords = useMemo(() => vndToVietnameseDocumentLine(formTotal), [formTotal]);

  const slipNoStr = slip?.slipNo != null ? String(slip.slipNo).padStart(4, "0") : "—";
  const recipientName = slip?.recipientDisplayName?.trim() || "—";
  const recipientUnitLabel = slip?.recipientUnit?.name ?? "—";
  const issueDateLine = formatIssueSlipPrintDate(slip?.issueDate);

  function lineAmount(l) {
    const a = Number(l.amount);
    if (Number.isFinite(a)) {
      return a;
    }
    const q = Number(l.quantity);
    const p = Number(l.unitPrice);
    if (!Number.isFinite(q) || !Number.isFinite(p)) {
      return 0;
    }
    return Math.round(q * p * 100) / 100;
  }

  return (
    <div
      className={printBlockClass}
      style={{
        fontFamily: font,
        // Một mốc cỡ cơ sở; mọi phần tử con dùng em để đồng bộ in/PDF
        fontSize: `${fontSizePt}pt`,
        lineHeight: 1.35,
        pageBreakAfter: breakAfter ? "always" : "auto",
      }}
    >
      <style
        // Đảm bảo bảng & viền dù in nền trắng
        dangerouslySetInnerHTML={{
          __html: `
        .lttp-isd-print table { border-collapse: collapse; }
        .lttp-isd-print .lttp-isd-mono { font-family: ui-monospace, "Courier New", monospace; }
        .lttp-isd-print .lttp-isd-nums { font-variant-numeric: tabular-nums; }
      `,
        }}
      />

      {/* ——— 30% | 40% | 30%: mỗi cột căn giữa nội dung theo ngang; cả hàng căn giữa theo dọc —— */}
      <header className="mb-[1.1em] flex w-full flex-nowrap items-center gap-2 font-bold leading-tight [text-rendering:optimizeLegibility]">
        <div className="flex min-w-0 basis-0 flex-[3] flex-col items-center text-center">
          {slip?.printLine1 ? (
            <p className="m-0 w-full text-[1em] uppercase tracking-[0.02em]">{slip.printLine1}</p>
          ) : (
            <p className="m-0 min-h-[1em] w-full text-[1em]">{"\u00A0"}</p>
          )}
          {slip?.printLine2 ? (
            <div className="mt-[0.35em] flex w-full justify-center">
              <div className="inline-block max-w-full text-center">
                <p className="m-0 text-[1em] uppercase leading-none tracking-[0.04em]">{slip.printLine2}</p>
                <div className="mx-auto mt-[0.2em] h-px w-1/2 max-w-full bg-black" />
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-w-0 basis-0 flex-[4]" aria-hidden="true" />
        <div className="flex min-w-0 basis-0 flex-[3] flex-col items-center text-center text-[0.92em]">
          {slip?.formMauSo ? (
            <p className="m-0 w-full text-[0.88em] font-bold normal-case leading-snug tracking-normal">
              {slip.formMauSo}
            </p>
          ) : null}
          <p className={`m-0 w-full font-bold ${slip?.formMauSo ? "mt-[0.35em]" : ""}`}>
            Quyển số: {slip?.bookMmyy ?? "—"}
          </p>
          <p className="m-0 mt-[0.2em] w-full font-bold">Số: {slipNoStr}</p>
        </div>
      </header>

      {/* ——— Tên bảng ——— */}
      <h2 className="m-0 text-center text-[1.12em] font-extrabold uppercase tracking-[0.12em] [font-weight:800]">
        PHIẾU XUẤT KHO
      </h2>
      {issueDateLine ? (
        <p className="m-0 mb-[0.85em] mt-[0.15em] text-center text-[0.95em] italic">
          {issueDateLine}
        </p>
      ) : (
        <div className="mb-[0.85em]" />
      )}

      {/* ——— Thông tin người nhận: căn trái, nhãn đậm ——— */}
      <div className="mb-[0.7em] max-w-full space-y-[0.2em] text-left text-[0.95em] leading-[1.45] [text-align:left]">
        <p className="m-0 pr-1">
          <span className="font-bold">Họ và tên người nhận hàng: </span>
          {recipientName}
        </p>
        <p className="m-0 pr-1">
          <span className="font-bold">Đơn vị: </span>
          {recipientUnitLabel}
        </p>
        <p className="m-0 pr-1">
          <span className="font-bold">Nhận tại kho: </span>
          {slip?.warehouseFrom || "—"}
        </p>
      </div>

      {/* Cột: STT | Tên (trái) | Mã | ĐV | YC | TX | Giá (phải) | Thành tiền (phải) | Ghi chú (giữa) */}
      <table
        className="lttp-isd-table w-full table-fixed text-[0.95em] [border-width:0.4pt]"
        style={{ border: "0.4pt solid #000" }}
      >
        {/*
          Tỷ lệ cột = 100%: 4+30+7+4+5.5+5.5+10+10+24 (STT rộng hơn cho đủ chữ «STT»)
          Tên mặt hàng trái; Giá, Thành tiền phải; STT, Mã, ĐV, số lượng, ghi chú giữa.
        */}
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "24%" }} />
        </colgroup>
        <thead>
          <tr>
            <th
              className="box-border border border-black p-[0.15em] text-center align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              STT
            </th>
            <th
              className="box-border border border-black p-[0.2em] text-left align-middle text-[0.7em] font-bold leading-tight [border-width:0.4pt]"
              rowSpan={2}
            >
              Tên, quy cách vật tư, sản phẩm
            </th>
            <th
              className="box-border border border-black p-[0.15em] text-center align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              Mã
            </th>
            <th
              className="box-border border border-black p-[0.12em] text-center align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              ĐV
            </th>
            <th
              className="box-border border border-black p-[0.12em] text-center align-middle text-[0.65em] font-bold [border-width:0.4pt]"
              colSpan={2}
            >
              Số lượng
            </th>
            <th
              className="box-border border border-black p-[0.12em] text-right align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              Giá
            </th>
            <th
              className="box-border border border-black p-[0.12em] text-right align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              Thành tiền
            </th>
            <th
              className="box-border border border-black p-[0.12em] text-center align-middle text-[0.75em] font-bold [border-width:0.4pt]"
              rowSpan={2}
            >
              Ghi chú
            </th>
          </tr>
          <tr>
            <th className="box-border border border-black p-[0.1em] text-center text-[0.7em] font-bold [border-width:0.4pt]">
              Yêu cầu
            </th>
            <th className="box-border border border-black p-[0.1em] text-center text-[0.7em] font-bold [border-width:0.4pt]">
              Thực xuất
            </th>
          </tr>
        </thead>
        <tbody>
          {dataRows.map((r, sttIdx) => {
            const c = r.commodity;
            const stt = sttIdx + 1;
            const reqRaw = r.requiredQuantity;
            const hasReq = reqRaw !== null && reqRaw !== undefined && String(reqRaw).trim() !== "";
            return (
              <tr key={r.id ?? stt}>
                <td className="lttp-isd-nums box-border border border-black p-[0.12em] text-center text-[0.9em] [border-width:0.4pt]">
                  {stt}
                </td>
                <td className="box-border border border-black p-[0.12em] text-left align-top text-[0.9em] [border-width:0.4pt]">
                  {c?.name ?? "—"}
                </td>
                <td className="lttp-isd-mono box-border border border-black p-[0.1em] text-center text-[0.78em] [border-width:0.4pt]">
                  {c?.code ?? "—"}
                </td>
                <td className="box-border border border-black p-[0.1em] text-center text-[0.86em] [border-width:0.4pt]">
                  {c?.measureUnit ?? "—"}
                </td>
                <td className="lttp-isd-nums box-border border border-black p-[0.1em] text-center text-[0.8em] [border-width:0.4pt]">
                  {hasReq ? formatVnQtyComma(reqRaw, 3) : "—"}
                </td>
                <td className="lttp-isd-nums box-border border border-black p-[0.1em] text-center text-[0.8em] [border-width:0.4pt]">
                  {formatVnQtyComma(r.quantity, 3)}
                </td>
                <td className="lttp-isd-nums box-border border border-black p-[0.1em] text-right text-[0.88em] [border-width:0.4pt]">
                  {r.unitPrice != null ? formatVnIntDot(r.unitPrice) : "—"}
                </td>
                <td className="lttp-isd-nums box-border border border-black p-[0.1em] text-right text-[0.88em] [border-width:0.4pt]">
                  {formatVnIntDot(Math.round(lineAmount(r)))}
                </td>
                <td className="box-border border border-black p-[0.1em] text-center text-[0.8em] [border-width:0.4pt]">
                  {(r.lineNote ?? "").trim() || " "}
                </td>
              </tr>
            );
          })}
          <tr>
            <td
              colSpan={7}
              className="box-border border border-black p-[0.2em] text-center text-[0.9em] font-bold uppercase [border-width:0.4pt]"
            >
              TỔNG CỘNG
            </td>
            <td className="lttp-isd-nums box-border border border-black p-[0.2em] text-right text-[0.9em] font-bold [border-width:0.4pt]">
              {formatVnIntDot(Math.round(formTotal))}
            </td>
            <td className="box-border border border-black p-[0.1em] [border-width:0.4pt]" />
          </tr>
        </tbody>
      </table>

      <p className="mb-[0.7em] mt-[0.4em] text-left text-[0.86em] italic leading-[1.45] [text-rendering:optimizeLegibility]">
        Tổng số tiền (Viết bằng chữ): {totalInWords || "—"}
      </p>

      {/* Chữ ký: nhãn in đậm, khoảng trống ký, tên dưới cùng in đậm */}
      <div className="mt-[0.3em] grid w-full break-inside-avoid grid-cols-3 gap-x-[0.2em] text-center [font-size:0.9em]">
        <div className="px-[0.1em]">
          <p className="m-0 text-[0.9em] font-extrabold uppercase leading-tight tracking-[0.06em] [font-weight:800]">
            Người viết phiếu
          </p>
          <div className="h-[3.2em]" />
          <p className="m-0 pt-[0.1em] text-[0.95em] font-extrabold [font-weight:800] [text-rendering:optimizeLegibility]">
            {slip?.signerWriter || "—"}
          </p>
        </div>
        <div className="px-[0.1em]">
          <p className="m-0 text-[0.9em] font-extrabold uppercase leading-tight tracking-[0.06em] [font-weight:800]">
            Người nhận hàng
          </p>
          <div className="h-[3.2em]" />
          <p className="m-0 pt-[0.1em] text-[0.95em] font-extrabold [font-weight:800] [text-rendering:optimizeLegibility]">
            {slip?.signerRecipient || slip?.recipientDisplayName || "—"}
          </p>
        </div>
        <div className="px-[0.1em]">
          <p className="m-0 text-[0.9em] font-extrabold uppercase leading-tight tracking-[0.06em] [font-weight:800]">
            Người duyệt
          </p>
          <div className="h-[3.2em]" />
          <p className="m-0 pt-[0.1em] text-[0.95em] font-extrabold [font-weight:800] [text-rendering:optimizeLegibility]">
            {slip?.signerApprover || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
