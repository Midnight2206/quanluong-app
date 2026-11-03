"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { monthOf } from "./kitchenPaperBook.js";
import { PAPER_CSS, renderPaperDocument } from "./kitchenPaperHtml.js";
import { addDaysYmd, calendarCells } from "./kitchenPaperForm.js";

const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function KitchenPaperChrome({
  date,
  onDate,
  markers,
  onPrintDay,
  onPrintMonth,
  busy,
  extra,
  children,
}) {
  const [openCal, setOpenCal] = useState(false);
  const month = monthOf(date);
  const cells = calendarCells(month);

  return (
    <div className="kitchen-paper-shell relative flex min-w-0 flex-col gap-3">
      <style>{PAPER_CSS}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="h-11 min-w-11 px-3" onClick={() => onDate(addDaysYmd(date, -1))} aria-label="Ngày trước">◀</Button>
        <Button type="button" variant="secondary" className="h-11 px-3" onClick={() => setOpenCal((value) => !value)} aria-expanded={openCal}>
          {date.split("-").reverse().join("/")}
        </Button>
        <Button type="button" variant="secondary" className="h-11 min-w-11 px-3" onClick={() => onDate(addDaysYmd(date, 1))} aria-label="Ngày sau">▶</Button>
        <Button type="button" variant="secondary" className="h-11 px-3" disabled={busy} onClick={onPrintDay}>Xuất PDF ngày</Button>
        <Button type="button" variant="secondary" className="h-11 px-3" disabled={busy} onClick={onPrintMonth}>Xuất PDF tháng</Button>
        {extra}
      </div>
      {openCal ? (
        <div className="paper-cal no-print" data-local-scroll="true" role="dialog" aria-label="Lịch tháng">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" className="h-11 min-w-11" onClick={() => onDate(`${addDaysYmd(`${month}-01`, -1).slice(0, 7)}-01`)}>◀</Button>
            <strong>Tháng {month.slice(5)}/{month.slice(0, 4)}</strong>
            <Button type="button" variant="ghost" className="h-11 min-w-11" onClick={() => onDate(`${addDaysYmd(`${month}-28`, 10).slice(0, 7)}-01`)}>▶</Button>
            <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setOpenCal(false)}>Đóng</Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEK.map((label) => <span key={label}>{label}</span>)}
            {cells.map((day, index) => {
              if (!day) return <span key={`e${index}`} />;
              const mark = markers?.[day];
              return (
                <button
                  key={day}
                  type="button"
                  className="h-11 rounded border border-transparent hover:border-border"
                  onClick={() => {
                    onDate(day);
                    setOpenCal(false);
                  }}
                >
                  {Number(day.slice(8))}
                  {mark?.negative ? <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-red-600 mx-auto" /> : null}
                  {mark?.hasData && !mark.negative ? <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-emerald-700 mx-auto" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function openPaperPrint(pages) {
  const html = Array.isArray(pages) ? renderPaperDocument(pages) : pages;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    win.print();
  }, 200);
  return true;
}
