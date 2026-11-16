"use client";

import { useEffect, useState } from "react";
import { PermissionSectionDenied } from "@/features/permissions/permissionUi";
import { MidnightTabMatrix } from "./MidnightTabMatrix";
import { MidnightTabPartnerDebts } from "./MidnightTabPartnerDebts";
import { MidnightTabPartnerPrices } from "./MidnightTabPartnerPrices";
import { fieldClass, labelClass } from "./midnightUi";

const TABS = [
  { id: "prices", label: "Giá đối tác" },
  { id: "matrix", label: "Theo ngày & ĐV nhận" },
  { id: "debts", label: "Công nợ" },
];

export function MidnightMainPanel({ grants }) {
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
          if (rows?.length) setUnitId(String(rows[0].id));
        }
      } catch (e) {
        if (!c) setLoadErr(e?.message || "Lỗi");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5"
          role="tablist"
          aria-label="Mục báo cáo"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={[
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition max-lg:min-h-11 max-lg:px-3 sm:text-sm",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className={`${labelClass} flex items-center gap-2 sm:shrink-0`}>
          <span className="whitespace-nowrap">Đơn vị</span>
          <select
            className={`${fieldClass} min-w-[10rem] sm:min-w-[14rem]`}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={units.length <= 1}
          >
            {units.length === 0 ? <option value="">—</option> : null}
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadErr ? <p className="text-sm text-destructive">{loadErr}</p> : null}

      {tab === "prices" ? (
        grants?.pricesRead ? (
          <MidnightTabPartnerPrices unitId={unitId} canWrite={Boolean(grants?.pricesWrite)} />
        ) : (
          <PermissionSectionDenied />
        )
      ) : tab === "matrix" ? (
        grants?.matrixRead ? (
          <MidnightTabMatrix unitId={unitId} />
        ) : (
          <PermissionSectionDenied />
        )
      ) : grants?.debtsRead ? (
        <MidnightTabPartnerDebts unitId={unitId} canWrite={Boolean(grants?.debtsWrite)} />
      ) : (
        <PermissionSectionDenied />
      )}
    </div>
  );
}
