"use client";

import { useEffect, useState } from "react";
import { MidnightTabMatrix } from "./MidnightTabMatrix";
import { MidnightTabPartnerDebts } from "./MidnightTabPartnerDebts";
import { MidnightTabPartnerPrices } from "./MidnightTabPartnerPrices";

const TABS = [
  { id: "prices", label: "Giá đối tác" },
  { id: "matrix", label: "Báo cáo theo ngày & ĐV nhận" },
  { id: "debts", label: "Công nợ đối tác" },
];

export function MidnightMainPanel() {
  const [tab, setTab] = useState("prices");
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      setLoadErr("");
      try {
        const r = await fetch("/api/midnight-secret/units", { credentials: "include" });
        const j = await r.json();
        if (!r.ok) {
          throw new Error(j?.error?.message || j?.message || "Không tải đơn vị");
        }
        const rows = j?.data ?? [];
        if (!c) {
          setUnits(Array.isArray(rows) ? rows : []);
          if (rows?.length) {
            setUnitId(String(rows[0].id));
          }
        }
      } catch (e) {
        if (!c) {
          setLoadErr(e?.message || "Lỗi");
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-4 px-3 py-6 sm:px-6">
      <p className="text-sm text-slate-600">
        Báo cáo nội bộ: giá lấy từ <span className="font-medium text-slate-800">bảng giá đối tác</span> (tách
        bảng giá LTTP gốc), hiệu lực theo <span className="font-medium">đơn vị + ngày</span> giống cơ chế
        công bố.
      </p>
      {loadErr ? <p className="text-sm text-red-600">{loadErr}</p> : null}

      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prices" ? (
        <MidnightTabPartnerPrices units={units} unitId={unitId} onUnitId={setUnitId} />
      ) : tab === "matrix" ? (
        <MidnightTabMatrix units={units} unitId={unitId} onUnitId={setUnitId} />
      ) : (
        <MidnightTabPartnerDebts />
      )}
    </div>
  );
}
