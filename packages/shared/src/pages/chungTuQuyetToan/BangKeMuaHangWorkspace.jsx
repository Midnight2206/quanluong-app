"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useChungTuTemplateCatalogQuery } from "@/features/chung-tu-quyet-toan/api/chungTuTemplateCatalogApi";
import {
  BANG_KE_MUA_HANG_CATEGORY_KEY,
  BKMH_DEFAULT_FORM,
  BKMH_DRAFT_STORAGE_KEY,
  BKMH_TEMPLATE_SPEC,
} from "./bangKeMuaHangConstants.js";

const FIELD_ROWS = [
  [
    { key: "donViCapTren", label: "Đơn vị cấp trên (vd. Sư đoàn)" },
    { key: "donViSo", label: "Đơn vị soạn (vd. Trung đoàn)" },
  ],
  [
    { key: "mauSo", label: "Mẫu số" },
    { key: "quyenSo", label: "Quyển số" },
  ],
  [
    { key: "soChungTu", label: "Số chứng từ" },
    { key: "hoTenNguoiMua", label: "Họ tên người mua hàng" },
  ],
  [{ key: "boPhan", label: "Bộ phận", full: true }],
  [
    { key: "noTaiKhoan", label: "Nợ …" },
    { key: "coTaiKhoan", label: "Có …" },
  ],
  [{ key: "tongTienBangChu", label: "Tổng số tiền (Viết bằng chữ)", full: true }],
  [{ key: "ghiChu", label: "Ghi chú", full: true }],
];

function loadDraftForm() {
  if (typeof window === "undefined") {
    return { ...BKMH_DEFAULT_FORM };
  }
  try {
    const raw = window.localStorage.getItem(BKMH_DRAFT_STORAGE_KEY);
    if (!raw) {
      return { ...BKMH_DEFAULT_FORM };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...BKMH_DEFAULT_FORM };
    }
    return { ...BKMH_DEFAULT_FORM, ...parsed };
  } catch {
    return { ...BKMH_DEFAULT_FORM };
  }
}

/** Kích thước trang trong hệ điểm PDF (~A4 máy in / Word). */
const A4_PAGE_W_PT = 595;
const A4_PAGE_H_PT = 842;

function displayDraftText(value) {
  const s = value != null ? String(value).trim() : "";
  return s || "\u00a0";
}

/**
 * Thu nhỏ trang cố định A4 theo chiều ngang ô chứa (giống Print preview của Word — tờ giữ tỉ lệ).
 */
function A4ScaledPrintPreviewCanvas({ children }) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0.72);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return undefined;
    }
    function measure() {
      const cw = el.clientWidth;
      const gutter = 20;
      const next = cw > gutter ? Math.min(1, (cw - gutter) / A4_PAGE_W_PT) : 0.32;
      setScale(Number.isFinite(next) ? next : 0.72);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="mx-auto flex w-full max-w-full justify-center px-2 print:px-0 sm:px-3">
        <div
          className="rounded-md shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ring-2 ring-neutral-400/55 bkmh-a4-print-host print:shadow-none print:ring-0"
        style={{
          width: A4_PAGE_W_PT * scale,
          height: A4_PAGE_H_PT * scale,
        }}
      >
        <div
          className="bkmh-a4-scale-box origin-top-left overflow-hidden rounded-[3px] print:overflow-visible print:rounded-none"
          style={{
            width: A4_PAGE_W_PT,
            height: A4_PAGE_H_PT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Gợi ý nhập khớp `BKMH_TEMPLATE_SPEC.detailPipeOrder7`. Có thể dùng 8 «|» (có Mã số) — hiển thị trong cột bán. */
const BKMH_DETAIL_PIPE_HINT = BKMH_TEMPLATE_SPEC.detailPipeOrder7.join("|");

function bangKeUpperUnit(s) {
  const t = s != null ? String(s).trim() : "";
  return t ? t.toUpperCase() : "";
}

function BangKePaperContent({ form, selected }) {
  const detailLinesRaw =
    typeof form.chiTietDongBang === "string" && form.chiTietDongBang.trim()
      ? form.chiTietDongBang.trim().split(/\r?\n/).filter(Boolean)
      : [];

  function parseCells(line) {
    if (/\|/.test(line)) {
      return line.split("|").map((x) => x.trim());
    }
    if (line.includes("\t")) {
      return line.split(/\t/).map((x) => x.trim());
    }
    return [line.trim()];
  }

  /**
   * Ánh xạ dòng chi tiết → bảng 9 ô như BKMH925 (sheet 01).
   * Chuẩn 7 «|»: TT|Tên|ĐVT|Tên người bán|SL|ĐG|Thành tiền — khớp `BKMH_TEMPLATE_SPEC`.
   * 8 «|» (legacy): thêm Mã số trước Tên người bán; hiển thị Mã trong ô bán (mẫu gốc không tách cột).
   */
  function mapDetailLine(ln, idx) {
    const hasDelim = /\|/.test(ln) || ln.includes("\t");
    const cells = hasDelim ? parseCells(ln) : [];
    const pad = (i) => (cells[i] != null ? String(cells[i]).trim() : "");

    if (hasDelim && cells.length >= 8) {
      return {
        tt: pad(0) || String(idx + 1),
        ten: pad(1),
        dvt: pad(2),
        maSo: pad(3),
        ban: pad(4),
        sl: pad(5),
        dg: pad(6),
        thanhTien: pad(7),
      };
    }
    if (hasDelim && cells.length === 7) {
      return {
        tt: pad(0) || String(idx + 1),
        ten: pad(1),
        dvt: pad(2),
        maSo: "",
        ban: pad(3),
        sl: pad(4),
        dg: pad(5),
        thanhTien: pad(6),
      };
    }
    if (hasDelim && cells.length === 6) {
      return {
        tt: pad(0) || String(idx + 1),
        ten: pad(1),
        dvt: pad(2),
        maSo: "",
        ban: pad(3),
        sl: pad(4),
        dg: pad(5),
        thanhTien: "",
      };
    }
    if (hasDelim && cells.length >= 5) {
      return {
        tt: pad(0) || String(idx + 1),
        ten: pad(1),
        dvt: pad(2),
        maSo: "",
        ban: "",
        sl: pad(3),
        dg: pad(4),
        thanhTien: "",
      };
    }
    if (hasDelim && cells.length >= 2) {
      return {
        tt: pad(0) || String(idx + 1),
        ten: pad(1),
        dvt: "",
        maSo: "",
        ban: "",
        sl: "",
        dg: "",
        thanhTien: "",
      };
    }
    return {
      tt: String(idx + 1),
      ten: ln.trim(),
      dvt: "",
      maSo: "",
      ban: "",
      sl: "",
      dg: "",
      thanhTien: "",
    };
  }

  const parsedRows = detailLinesRaw.map((ln, idx) => mapDetailLine(ln, idx));

  const hasStructuredCols = detailLinesRaw.some((ln) => /\|/.test(ln) || ln.includes("\t"));

  const BODY_LINE_COUNT = 8;
  const bodyRows =
    parsedRows.length > 0
      ? [
          ...parsedRows.slice(0, BODY_LINE_COUNT),
          ...Array(Math.max(0, BODY_LINE_COUNT - Math.min(parsedRows.length, BODY_LINE_COUNT))).fill(null),
        ].slice(0, BODY_LINE_COUNT)
      : [...Array(BODY_LINE_COUNT)].map(() => null);

  const donViCapTrenU = bangKeUpperUnit(form.donViCapTren);
  const donViSoU = bangKeUpperUnit(form.donViSo);

  return (
    <article
      className="bkmh-print-root relative box-border flex h-[842px] w-[595px] flex-col overflow-hidden bg-white px-[42px] pb-[40px] pt-[40px] text-black antialiased print:h-auto print:min-h-[842px] print:overflow-visible"
      style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
    >
      {/* Hàng đơn vị — tiêu đề — Mẫu/Quyển/Số (theo BKMH925 hàng 1–3) */}
      <header className="shrink-0 border-b-[1px] border-black pb-2">
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,0.9fr)] items-stretch gap-x-2 text-[11px] leading-snug">
          <div className="flex flex-col justify-center gap-1.5 text-center font-bold uppercase tracking-tight">
            <div>{displayDraftText(donViCapTrenU)}</div>
            <div>{displayDraftText(donViSoU)}</div>
          </div>
          <div className="flex items-center justify-center border-x border-black/15 px-1">
            <div className="text-center">
              <h1 className="text-[14px] font-bold uppercase leading-tight">{BKMH_TEMPLATE_SPEC.title}</h1>
              {selected ? (
                <p className="mt-0.5 whitespace-normal break-words text-[9px] font-normal normal-case tracking-normal text-neutral-700">
                  (Mẫu: {selected.displayName})
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5 text-right leading-tight">
            <div>
              Mẫu số<span className="font-semibold"> {displayDraftText(form.mauSo)}</span>
            </div>
            <div className="flex items-end justify-end gap-1">
              <span className="shrink-0">Quyển số:</span>
              <span className="min-w-[4.25rem] border-b border-black px-0.5 text-left font-medium">{displayDraftText(form.quyenSo)}</span>
            </div>
            <div className="flex items-end justify-end gap-1">
              <span className="shrink-0">Số:</span>
              <span className="min-w-[4.25rem] border-b border-black px-0.5 text-left font-medium">{displayDraftText(form.soChungTu)}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-3 min-h-0 flex-1 overflow-y-auto pb-1.5 text-[11px] leading-snug">
        <div className="flex text-[11px] leading-snug">
          <span className="shrink-0 whitespace-pre font-normal text-black">{"      - Họ tên người mua hàng:"}</span>
          <span className="ml-1 min-w-0 flex-1 border-b border-black pb-px font-medium">{displayDraftText(form.hoTenNguoiMua)}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-[12rem] flex-1 text-[11px]">
            <span className="shrink-0 whitespace-pre font-normal text-black">{"      - Bộ phận:"}</span>
            <span className="ml-1 min-w-0 flex-1 border-b border-black pb-px font-medium">{displayDraftText(form.boPhan)}</span>
          </div>
          <div className="flex shrink-0 items-end gap-1 text-[11px]">
            <span>Nợ:</span>
            <span className="min-w-[6.5rem] border-b border-black px-0.5 pb-px text-center font-medium">{displayDraftText(form.noTaiKhoan)}</span>
          </div>
        </div>
        <div className="mt-1 flex justify-end text-[11px]">
          <span className="shrink-0">Có:</span>
          <span className="ml-1 min-w-[6.5rem] border-b border-black px-0.5 pb-px text-center font-medium">{displayDraftText(form.coTaiKhoan)}</span>
        </div>

        <div className="mt-3 pb-px">
          <table className="w-full table-fixed border-collapse border border-black text-[9px] leading-tight">
            <colgroup>
              <col style={{ width: "22px" }} />
              <col />
              <col style={{ width: "26px" }} />
              <col span={3} style={{ width: "36%" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "46px" }} />
              <col style={{ width: "48px" }} />
            </colgroup>
            <thead>
              <tr className="bg-[#d9d9d9] text-center align-middle [&_th]:border [&_th]:border-black [&_th]:px-0.5 [&_th]:py-1 [&_th]:font-semibold">
                <th rowSpan={2}>{BKMH_TEMPLATE_SPEC.tableHeaderRow[0]}</th>
                <th rowSpan={2} className="text-[9px] font-semibold leading-[1.15]">
                  {BKMH_TEMPLATE_SPEC.tableHeaderRow[1]}
                </th>
                <th rowSpan={2}>{BKMH_TEMPLATE_SPEC.tableHeaderRow[2]}</th>
                <th colSpan={3} className="text-[9px] leading-[1.15]">
                  {BKMH_TEMPLATE_SPEC.tableHeaderRow[3]}
                </th>
                <th rowSpan={2} className="text-[9px] leading-[1.1]">
                  {BKMH_TEMPLATE_SPEC.tableHeaderRow[4]}
                </th>
                <th rowSpan={2} className="text-[9px] leading-[1.1]">
                  {BKMH_TEMPLATE_SPEC.tableHeaderRow[5]}
                </th>
                <th rowSpan={2} className="text-[9px] leading-[1.1]">
                  {BKMH_TEMPLATE_SPEC.tableHeaderRow[6]}
                </th>
              </tr>
              <tr className="h-2.5 bg-white [&_th]:border [&_th]:border-black" aria-hidden>
                <th colSpan={3} className="p-0" />
              </tr>
            </thead>
            <tbody className="[&_td]:border [&_td]:border-black [&_td]:px-0.5 [&_td]:py-1">
              {bodyRows.map((r, i) => (
                <tr key={i} className="min-h-[22px] align-top text-[10px]">
                  <td className="text-center font-medium">{r ? displayDraftText(r.tt) : "\u00a0"}</td>
                  <td className="text-left">
                    {r ? (
                      <>
                        <span className="block">{displayDraftText(r.ten)}</span>
                        {i === 0 && !hasStructuredCols && detailLinesRaw.length ? (
                          <span className="mt-0.5 block text-[8px] font-normal leading-tight text-neutral-500">
                            Chuẩn mẫu {BKMH_TEMPLATE_SPEC.sourceFile}: «|» hoặc Tab — {BKMH_DETAIL_PIPE_HINT}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "\u00a0"
                    )}
                  </td>
                  <td className="text-center">{r ? displayDraftText(r.dvt) : "\u00a0"}</td>
                  <td colSpan={3} className="text-left">
                    {r ? (
                      <>
                        {r.maSo ? (
                          <span className="mb-0.5 block text-[9px] font-normal text-neutral-800">Mã {displayDraftText(r.maSo)}</span>
                        ) : null}
                        <span className="block">{displayDraftText(r.ban)}</span>
                      </>
                    ) : (
                      "\u00a0"
                    )}
                  </td>
                  <td className="text-right">{r ? displayDraftText(r.sl) : "\u00a0"}</td>
                  <td className="text-right">{r ? displayDraftText(r.dg) : "\u00a0"}</td>
                  <td className="text-right">{r ? displayDraftText(r.thanhTien) : "\u00a0"}</td>
                </tr>
              ))}
              <tr className="align-middle border-b border-black font-semibold">
                <td colSpan={2} className="px-1 py-1">
                  Cộng
                </td>
                <td />
                <td colSpan={3} />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-relaxed">
          <span className="whitespace-pre">{"       Tổng số tiền (Viết bằng chữ): "}</span>
          <span className="inline-block min-w-[55%] border-b border-black px-1 font-medium leading-none">
            {displayDraftText(form.tongTienBangChu)}
          </span>
        </div>

        <div className="mt-3 text-[11px] leading-relaxed">
          <span>Ghi chú: </span>
          <span className="inline-block min-w-[78%] border-b border-black px-0.5 font-medium">{displayDraftText(form.ghiChu)}</span>
        </div>

        {/* Chữ ký — hàng 16–17 + khoảng ký tên (theo mẫu Excel) */}
        <div className="mt-8 text-center text-[10px] font-bold uppercase leading-tight">
          <div className="grid grid-cols-3 gap-x-2">
            <div>THỦ KHO</div>
            <div>TRỢ LÝ QUÂN NHU</div>
            <div className="normal-case">TL. TRUNG ĐOÀN TRƯỞNG</div>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-x-2">
            <div />
            <div />
            <div>CHỦ NHIỆM HẬU CẦN</div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-x-3 text-center text-[10px]">
          <div className="min-h-[2.5rem] border-t border-black pt-1 font-normal normal-case text-neutral-800" />
          <div className="min-h-[2.5rem] border-t border-black pt-1 font-normal normal-case text-neutral-800" />
          <div className="min-h-[2.5rem] border-t border-black pt-1 font-normal normal-case text-neutral-800" />
        </div>
      </section>
    </article>
  );
}

function BangKeMuaHangPreview({ items, selectedId, form, isLoadingTemplates, templatesError }) {
  const selected = useMemo(() => items.find((t) => Number(t.id) === Number(selectedId)) ?? null, [items, selectedId]);
  const openHref =
    selected?.webViewLink ||
    (selected?.driveFileId
      ? selected.mimeType?.includes?.("spreadsheet")
        ? `https://docs.google.com/spreadsheets/d/${selected.driveFileId}/edit`
        : `https://docs.google.com/document/d/${selected.driveFileId}/edit`
      : null);

  return (
    <section className="min-w-0 space-y-3 lg:sticky lg:top-2 lg:self-start">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground sm:text-base">Xem trước in (A4)</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            Khớp layout <span className="font-mono text-[10px]">BKMH925.xlsx</span> (sheet{" "}
            <span className="font-mono">{BKMH_TEMPLATE_SPEC.sheetName}</span>). Thu nhỏ theo chiều ngang như Print preview;
            dữ liệu từ «Thông số»; file Google mở bằng nút.
          </p>
        </div>
        {openHref ? (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border-2 border-border/90 bg-card px-3 text-[11px] font-medium text-foreground shadow-sm transition",
              "hover:border-primary/35 hover:bg-muted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "sm:h-9 sm:text-xs",
            )}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Mở mẫu Google
          </a>
        ) : null}
      </div>

      {templatesError ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {(templatesError?.data?.message ?? templatesError?.data)?.toString?.() || "Không tải danh mục mẫu."}
        </p>
      ) : null}

      {isLoadingTemplates ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          Đang tải mẫu…
        </div>
      ) : null}

      <div className="rounded-xl border-2 border-border bg-gradient-to-b from-neutral-200/80 to-neutral-300/50 p-3 shadow-inner sm:p-4">
        <A4ScaledPrintPreviewCanvas>
          <BangKePaperContent form={form} selected={selected} />
        </A4ScaledPrintPreviewCanvas>
      </div>
    </section>
  );
}

export function BangKeMuaHangWorkspace() {
  const categoryKey = BANG_KE_MUA_HANG_CATEGORY_KEY;
  const { data: items = [], isLoading, isError, error, refetch } = useChungTuTemplateCatalogQuery(categoryKey);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (items.length && !items.some((t) => Number(t.id) === Number(selectedId))) {
      setSelectedId(items[0].id);
    }
    if (!items.length) {
      setSelectedId("");
    }
  }, [items, selectedId]);

  const [form, setForm] = useState(() => ({ ...BKMH_DEFAULT_FORM }));

  useEffect(() => {
    setForm(loadDraftForm());
  }, []);

  const persist = useCallback((next) => {
    try {
      window.localStorage.setItem(BKMH_DRAFT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const updateField = useCallback(
    (key, value) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleResetDraft = useCallback(() => {
    const next = { ...BKMH_DEFAULT_FORM };
    setForm(next);
    persist(next);
  }, [persist]);

  const handleClearStored = useCallback(() => {
    try {
      window.localStorage.removeItem(BKMH_DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setForm({ ...BKMH_DEFAULT_FORM });
  }, []);

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-10">
      <BangKeMuaHangPreview
        items={items}
        selectedId={selectedId}
        form={form}
        isLoadingTemplates={isLoading}
        templatesError={isError ? error : null}
      />

      <section className="min-w-0 space-y-5 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 xl:pl-10">
        <div>
          <h2 className="text-sm font-semibold text-foreground sm:text-base">Thông số chứng từ</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            Preview căn theo mẫu Excel trong repo (<span className="font-mono">BKMH925.xlsx</span>). Nháp chỉ lưu trình duyệt —
            chưa ghi file Google tự động.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">Danh mục mẫu</p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              Đang tải danh mục…
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(error?.data?.message ?? error?.data)?.toString?.() || "Không tải được danh sách template."}{" "}
              <button type="button" className="ml-2 underline underline-offset-2" onClick={() => refetch()}>
                Thử lại
              </button>
            </div>
          ) : null}

          {!isLoading && !isError && items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-[11px] text-muted-foreground sm:text-xs">
              Chưa có mẫu cho loại này. Cần bản ghi trong danh mục template chứng từ (backend / dữ liệu mẫu) kèm link
              Google Docs hoặc Sheets.
            </p>
          ) : null}

          <ul className="space-y-2">
            {items.map((t) => {
              const isOn = Number(selectedId) === Number(t.id);
              const quickHref =
                t.webViewLink ||
                (t.mimeType?.includes?.("spreadsheet")
                  ? `https://docs.google.com/spreadsheets/d/${t.driveFileId}/edit`
                  : `https://docs.google.com/document/d/${t.driveFileId}/edit`);

              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "flex w-full min-w-0 flex-col gap-2 rounded-xl border px-4 py-3 text-left outline-none transition sm:flex-row sm:items-start sm:justify-between",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isOn ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/25" : "border-border hover:border-primary/35",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.displayName}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                        {t.mimeType?.includes?.("spreadsheet") ? "Google Sheets" : "Google Docs"}
                        <span className="mx-1">·</span>
                        <span className="font-mono">{String(t.driveFileId ?? "").slice(0, 14)}…</span>
                      </p>
                    </div>
                    <a
                      href={quickHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Mở
                    </a>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="text-xs sm:text-sm" onClick={handleResetDraft}>
            Đặt lại mặc định
          </Button>
          <Button type="button" variant="ghost" className="text-xs sm:text-sm" onClick={handleClearStored}>
            Xóa nháp (trình duyệt)
          </Button>
        </div>

        <div className="space-y-4">
          {FIELD_ROWS.map((row, ri) => (
            <div key={ri} className={cn("grid gap-3", row.some((f) => f.full) ? "grid-cols-1" : "sm:grid-cols-2")}>
              {row.map(({ key, label, full }) => (
                <label key={key} className={cn("flex min-w-0 flex-col gap-1.5", full && "sm:col-span-2")}>
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <input
                    type="text"
                    value={form[key] ?? ""}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </label>
              ))}
            </div>
          ))}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Chi tiết bảng (nhiều dòng)</span>
            <textarea
              rows={8}
              value={form.chiTietDongBang ?? ""}
              onChange={(e) => updateField("chiTietDongBang", e.target.value)}
              placeholder="7 cột: TT|Tên hàng|ĐVT|Tên người bán|Số lượng|Đơn giá|Thành tiền — hoặc 8 cột có thêm Mã số trước cột bán (legacy)"
              className="min-h-[8rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
