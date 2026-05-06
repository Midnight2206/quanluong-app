import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  Loader2,
  Printer,
  RefreshCw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";
import {
  useCreateLttpIssueSlipMutation,
  useGetLttpCommoditiesQuery,
  useGetLttpSuppliersQuery,
  useGetLttpEffectivePricesQuery,
  useGetLttpIssueFormDefaultsQuery,
  useGetLttpNextIssueSlipSerialQuery,
  useGetLttpRecipientUsersQuery,
  useGetLttpReceivingDefaultRecipientQuery,
  usePutLttpIssueFormDefaultsMutation,
  useResyncLttpIssueSlipPricesMutation,
  useUpdateLttpIssueSlipMutation,
} from "@/features/lttp/api/lttpApi";
import { apiRequest } from "@/services/apiRequest";
import httpClient from "@/services/httpClient";
import { notifyError, notifySuccess, notifyWarning } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { vndToVietnameseDocumentLine } from "@/utils/vndVietnameseText";
import {
  clearIssueSlipDraft,
  readIssueSlipDraft,
  writeIssueSlipDraft,
} from "./lttpNhapXuatSessionPersist";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Họ tên hiển thị từ dòng user trong API recipient-users. */
function displayNameFromRecipientUserRow(p) {
  if (p == null) return "";
  const fn = p.fullName != null ? String(p.fullName).trim() : "";
  if (fn !== "") return fn;
  return p.username != null ? String(p.username).trim() : "";
}

/** Quyển số dạng MMYY theo ngày YYYY-MM-DD (khớp backend). */
function bookMmyyFromYmd(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return "----";
  }
  const yy = String(Number(m[1]) % 100).padStart(2, "0");
  return `${m[2]}${yy}`;
}

function newEmptyRow() {
  return {
    key: `r${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    commodityId: "",
    codeDraft: "",
    lttpSupplierId: "",
    requiredQuantity: "",
    quantity: "1",
    unitPrice: null,
    tgsxPrice: null,
    lineNote: "",
  };
}

/** Khôi phục dòng từ sessionStorage draft (chuẩn hoá kiểu, giữ stable key khi có). */
function normalizeStoredDraftRows(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [newEmptyRow()];
  }
  const out = raw.map((r, i) => ({
    key:
      typeof r?.key === "string" && String(r.key).trim()
        ? r.key
        : `r${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
    commodityId: (() => {
      if (r?.commodityId === "" || r?.commodityId == null) {
        return "";
      }
      const n = Number(r.commodityId);
      return Number.isInteger(n) && n > 0 ? n : "";
    })(),
    codeDraft: r?.codeDraft != null ? String(r.codeDraft) : "",
    lttpSupplierId:
      r?.lttpSupplierId !== "" && r?.lttpSupplierId != null
        ? String(r.lttpSupplierId)
        : "",
    requiredQuantity:
      r?.requiredQuantity != null && String(r.requiredQuantity).trim() !== ""
        ? String(r.requiredQuantity)
        : "",
    quantity:
      r?.quantity !== "" &&
      r?.quantity != null &&
      String(r.quantity).trim() !== ""
        ? String(r.quantity)
        : "1",
    unitPrice:
      typeof r?.unitPrice === "number" && Number.isFinite(r.unitPrice)
        ? r.unitPrice
        : r?.unitPrice === "" ||
            r?.unitPrice == null ||
            r?.unitPrice === undefined
          ? null
          : Number.isFinite(Number(r.unitPrice))
            ? Number(r.unitPrice)
            : null,
    tgsxPrice:
      typeof r?.tgsxPrice === "number" && Number.isFinite(r.tgsxPrice)
        ? r.tgsxPrice
        : r?.tgsxPrice === "" ||
            r?.tgsxPrice == null ||
            r?.tgsxPrice === undefined
          ? null
          : Number.isFinite(Number(r.tgsxPrice))
            ? Number(r.tgsxPrice)
            : null,
    lineNote: typeof r?.lineNote === "string" ? r.lineNote : "",
  }));
  return out.length ? out : [newEmptyRow()];
}

/** Chuyển dòng phiếu (snapshot từ BE) thành state ô của form sửa. */
function rowFromSlipLine(line) {
  const rand = Math.random().toString(36).slice(2, 7);
  return {
    key: `e${line.id}_${rand}`,
    commodityId: line.commodityId,
    codeDraft: line.commodity?.code ?? "",
    lttpSupplierId:
      line.lttpSupplierId != null ? String(line.lttpSupplierId) : "",
    requiredQuantity:
      line.requiredQuantity != null &&
      Number.isFinite(Number(line.requiredQuantity))
        ? String(line.requiredQuantity)
        : "",
    quantity: line.quantity != null ? String(line.quantity) : "",
    unitPrice: line.unitPrice ?? null,
    tgsxPrice: line.tgsxPrice ?? null,
    lineNote: typeof line?.lineNote === "string" ? line.lineNote : "",
  };
}

function isRowCompleteForSubmit(r) {
  if (!r.commodityId || r.unitPrice == null) {
    return false;
  }
  if (r.lttpSupplierId === "" || r.lttpSupplierId == null) {
    return false;
  }
  const sid = Number(r.lttpSupplierId);
  if (!Number.isInteger(sid) || sid <= 0) {
    return false;
  }
  const q = parsePositiveDecimalField(r.quantity);
  return Number.isFinite(q) && q > 0;
}

/** Dấu phẩy → chấm, bỏ khoảng (nhập số thập phân kiểu VN). */
function normalizeDecimalInputString(v) {
  if (v == null) {
    return "";
  }
  return String(v).replace(/\s/g, "").replace(/,/g, ".");
}

/** Số dương từ ô số lượng (hỗ trợ thập phân, number hoặc chuỗi đang gõ). */
function parsePositiveDecimalField(q) {
  if (q === "" || q == null) {
    return Number.NaN;
  }
  if (typeof q === "number") {
    return Number.isFinite(q) ? q : Number.NaN;
  }
  const s = normalizeDecimalInputString(q);
  if (s === "" || s === ".") {
    return Number.NaN;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Hiển thị số lượng dạng chuỗi (cho phép gõ dấu «,» thập phân). */
function quantityInputDisplay(q) {
  if (q === "" || q == null) {
    return "";
  }
  if (typeof q === "number" && !Number.isFinite(q)) {
    return "";
  }
  return String(q);
}

const COMMODITY_SEARCH_DEBOUNCE_MS = 300;
const COMMODITY_SEARCH_MAX = 100;

/**
 * Ô tìm mặt hàng (thay select dài): lọc theo tên/mã sau debounce; chọn từ danh sách portal.
 */
function IssueSlipCommoditySearch({
  rowKey,
  commodityId,
  selectedLabel,
  commodities,
  dupRow,
  inputClass,
  disabled,
  onPickCommodity,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => selectedLabel ?? "");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(query.trim().toLowerCase());
    }, COMMODITY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setQuery(selectedLabel ?? "");
  }, [commodityId, selectedLabel]);

  const filtered = useMemo(() => {
    const list = (commodities || []).filter((c) => c && c.id != null);
    const q = debouncedQ;
    if (!q) {
      return list.slice(0, COMMODITY_SEARCH_MAX);
    }
    return list
      .filter((c) => {
        const nm = String(c.name ?? "").toLowerCase();
        const cd = String(c.code ?? "").toLowerCase();
        return nm.includes(q) || cd.includes(q);
      })
      .slice(0, COMMODITY_SEARCH_MAX);
  }, [commodities, debouncedQ]);

  const refreshAnchor = useCallback(() => {
    const el = wrapRef.current;
    if (el) {
      setAnchor(el.getBoundingClientRect());
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    refreshAnchor();
    function onWin() {
      refreshAnchor();
    }
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin);
    };
  }, [open, refreshAnchor, filtered.length]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const listEl =
    open &&
    anchor &&
    createPortal(
      <ul
        className="fixed z-[120] max-h-52 overflow-y-auto rounded-md border border-border bg-card py-1 text-left text-xs text-card-foreground shadow-float"
        style={{
          top: anchor.bottom + 6,
          left: anchor.left,
          width: Math.max(anchor.width, 240),
          maxWidth: "min(96vw, 28rem)",
        }}
        role="listbox"
        aria-label="Kết quả tìm mặt hàng"
      >
        {filtered.length === 0 ? (
          <li className="bg-card px-3 py-2 text-muted-foreground">
            Không có mặt hàng khớp.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={`${rowKey}-${c.id}`} role="none">
              <button
                type="button"
                role="option"
                className="flex w-full items-start gap-2 bg-card px-3 py-2 text-left hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPickCommodity(rowKey, String(c.id));
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 font-medium text-foreground">
                  {c.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {c.code}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>,
      document.body,
    );

  return (
    <div ref={wrapRef} className="relative min-w-0 max-w-[14rem]">
      <input
        type="search"
        enterKeyHint="search"
        disabled={disabled}
        className={cn(
          inputClass,
          dupRow && "border-red-500/90 dark:border-red-400/80",
        )}
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setOpen(true);
          if (v === "") {
            onPickCommodity(rowKey, "");
            setQuery(v);
            return;
          }
          const canon = (selectedLabel ?? "").trim();
          if (
            commodityId !== "" &&
            commodityId != null &&
            canon !== "" &&
            v.trim() !== canon
          ) {
            onPickCommodity(rowKey, "");
          }
          setQuery(v);
        }}
        onFocus={() => {
          setOpen(true);
          queueMicrotask(refreshAnchor);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        placeholder="Gõ tìm mặt hàng…"
        autoComplete="off"
        spellCheck={false}
      />
      {typeof document !== "undefined" ? listEl : null}
    </div>
  );
}

const FONT_CHOICES = [
  { id: "system", label: "Hệ thống", value: "system-ui, sans-serif" },
  {
    id: "times",
    label: "Times New Roman",
    value: "'Times New Roman', Times, serif",
  },
  { id: "arial", label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { id: "georgia", label: "Georgia", value: "Georgia, serif" },
];

/**
 * Tab Phiếu xuất LTTP: bảng nhập (dòng mới khi hoàn tất dòng hiện tại + Enter ở Thực xuất), giá theo blur mã, in theo cùng mẫu lịch sử, tổng bằng chữ.
 *
 * Khi `editingSlip` được truyền, form chuyển sang chế độ sửa: khoá ngày phiếu (giữ ngày + quyển/số gốc),
 * prefill toàn bộ trường, đổi nút lưu thành «Cập nhật phiếu» và hiển thị nút «Hủy».
 */
export function LttpPhieuXuatTab({
  selectedUnitId,
  canWrite,
  unitLabel,
  units = [],
  canPickUnits,
  editingSlip = null,
  onCancelEdit,
  onUpdated,
}) {
  const isEditMode = !!editingSlip;
  const formId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(() => localYmd());

  const [marginTop, setMarginTop] = useState(2);
  const [marginRight, setMarginRight] = useState(1.5);
  const [marginBottom, setMarginBottom] = useState(1.5);
  const [marginLeft, setMarginLeft] = useState(3);
  const [printFontId, setPrintFontId] = useState("times");
  const [printFontSizePt, setPrintFontSizePt] = useState(12);

  const [printHeaderLine1, setPrintHeaderLine1] = useState("");
  const [printHeaderLine2, setPrintHeaderLine2] = useState("Quân nhu");
  const [formMauSo, setFormMauSo] = useState("Mẫu SS14-QN10");
  const [recipientName, setRecipientName] = useState("");
  const [recipientUnitLabel, setRecipientUnitLabel] = useState("");
  const [recipientUnitId, setRecipientUnitId] = useState(null);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [warehouseFrom, setWarehouseFrom] = useState("Quân nhu");
  const [signerWriter, setSignerWriter] = useState("");
  const [signerRecipient, setSignerRecipient] = useState("");
  const [signerApprover, setSignerApprover] = useState("");
  /** Phân biệt phiếu trên tab Đặt hàng — lưu `LttpIssueSlip.note`, không hiển thị trên bản in. */
  const [slipNote, setSlipNote] = useState("");

  const [rows, setRows] = useState(() => [newEmptyRow()]);
  const rowQtyRefs = useRef({});
  const rowCodeRefs = useRef({});

  /** Nháp phiếu xuất (sessionStorage): đổi kho hoặc F5 không mất nhập tay. Không áp vào chế độ sửa. */
  const [draftNotice, setDraftNotice] = useState(false);
  const prevCreateUnitRef = useRef(null);
  const skipRecipientResetAfterDraftRef = useRef(false);
  const skipReceivingDefAfterDraftRef = useRef(false);
  const draftPersistAllowedRef = useRef(false);

  const defLoadedKey = useRef(null);

  useLayoutEffect(() => {
    if (isEditMode) {
      draftPersistAllowedRef.current = true;
      return;
    }
    if (selectedUnitId == null) {
      draftPersistAllowedRef.current = false;
      return;
    }

    draftPersistAllowedRef.current = false;

    const prev = prevCreateUnitRef.current;
    const unitChanged = prev != null && Number(prev) !== Number(selectedUnitId);
    const draft = readIssueSlipDraft(selectedUnitId);

    if (draft && Number(draft.unitId) === Number(selectedUnitId)) {
      const ymd =
        typeof draft.issueDate === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(draft.issueDate)
          ? draft.issueDate
          : localYmd();

      setIssueDate(ymd);
      setMarginTop(
        Number.isFinite(Number(draft.marginTop)) ? Number(draft.marginTop) : 2,
      );
      setMarginRight(
        Number.isFinite(Number(draft.marginRight))
          ? Number(draft.marginRight)
          : 1.5,
      );
      setMarginBottom(
        Number.isFinite(Number(draft.marginBottom))
          ? Number(draft.marginBottom)
          : 1.5,
      );
      setMarginLeft(
        Number.isFinite(Number(draft.marginLeft))
          ? Number(draft.marginLeft)
          : 3,
      );
      setPrintFontId(
        typeof draft.printFontId === "string" && draft.printFontId
          ? draft.printFontId
          : "times",
      );
      setPrintFontSizePt(
        Number.isFinite(Number(draft.printFontSizePt))
          ? Math.min(18, Math.max(8, Number(draft.printFontSizePt)))
          : 12,
      );
      if (draft.printHeaderLine1 != null) {
        setPrintHeaderLine1(String(draft.printHeaderLine1));
      }
      if (draft.printHeaderLine2 != null) {
        setPrintHeaderLine2(String(draft.printHeaderLine2));
      }
      if (draft.formMauSo != null) {
        setFormMauSo(String(draft.formMauSo));
      }
      const ru = draft.recipientUnitId;
      const rid =
        ru != null && Number.isFinite(Number(ru))
          ? Number(ru)
          : Number.isFinite(Number(selectedUnitId))
            ? Number(selectedUnitId)
            : null;
      setRecipientUnitId(rid);
      setRecipientUserId(
        draft.recipientUserId != null ? String(draft.recipientUserId) : "",
      );
      setRecipientName(
        draft.recipientName != null ? String(draft.recipientName) : "",
      );
      skipReceivingDefAfterDraftRef.current =
        draft.recipientUserId != null &&
        String(draft.recipientUserId).trim() !== "";

      setWarehouseFrom(
        draft.warehouseFrom != null ? String(draft.warehouseFrom) : "Quân nhu",
      );
      setSignerWriter(
        draft.signerWriter != null ? String(draft.signerWriter) : "",
      );
      setSignerRecipient(
        draft.signerRecipient != null ? String(draft.signerRecipient) : "",
      );
      setSignerApprover(
        draft.signerApprover != null ? String(draft.signerApprover) : "",
      );
      setSlipNote(draft.slipNote != null ? String(draft.slipNote) : "");
      setRows(normalizeStoredDraftRows(draft.rows));

      skipRecipientResetAfterDraftRef.current = true;
      defLoadedKey.current = selectedUnitId;
      setDraftNotice(true);
      prevCreateUnitRef.current = selectedUnitId;
      draftPersistAllowedRef.current = true;
      return;
    }

    if (unitChanged) {
      setIssueDate(localYmd());
      setRows([newEmptyRow()]);
      setSlipNote("");
      defLoadedKey.current = null;
      setDraftNotice(false);
    }

    prevCreateUnitRef.current = selectedUnitId;
    draftPersistAllowedRef.current = true;
  }, [selectedUnitId, isEditMode]);
  const { data: formDefPayload } = useGetLttpIssueFormDefaultsQuery(
    selectedUnitId,
    { skip: !selectedUnitId },
  );
  const { data: nextSerialPayload, refetch: refetchNextSerial } =
    useGetLttpNextIssueSlipSerialQuery(
      { unitId: selectedUnitId, date: issueDate },
      { skip: !selectedUnitId },
    );
  const [putFormDefaults, { isLoading: putDefBusy }] =
    usePutLttpIssueFormDefaultsMutation();
  const { data: recipientUsers = [] } = useGetLttpRecipientUsersQuery(
    recipientUnitId,
    {
      skip: !recipientUnitId,
      staleTime: 5 * 60 * 1000,
    },
  );
  const { data: receivingDef, isSuccess: receivingDefSuccess } =
    useGetLttpReceivingDefaultRecipientQuery(recipientUnitId, {
      skip: !recipientUnitId,
    });

  const printFont =
    FONT_CHOICES.find((f) => f.id === printFontId) ?? FONT_CHOICES[0];

  const { data: commoditiesData, isLoading: cLoad } =
    useGetLttpCommoditiesQuery(selectedUnitId, {
      skip: !selectedUnitId,
    });
  const commodities = commoditiesData ?? [];
  const { data: suppliersData } = useGetLttpSuppliersQuery(selectedUnitId, {
    skip: !selectedUnitId,
  });
  const suppliers = suppliersData ?? [];
  const comById = useMemo(
    () => new Map(commodities.map((c) => [c.id, c])),
    [commodities],
  );

  const { data: eff, isLoading: eLoad } = useGetLttpEffectivePricesQuery(
    { unitId: selectedUnitId, date: issueDate },
    { skip: !selectedUnitId },
  );
  const priceByCommodityId = useMemo(() => {
    const m = new Map();
    for (const row of eff?.items || []) {
      m.set(row.commodity.id, row);
    }
    return m;
  }, [eff]);

  const bookMmyyDisplay = useMemo(
    () => bookMmyyFromYmd(issueDate),
    [issueDate],
  );
  const nextSlipNoDisplay = useMemo(() => {
    const n = nextSerialPayload?.nextSlipNo;
    if (n == null) {
      return "—";
    }
    return String(n).padStart(4, "0");
  }, [nextSerialPayload?.nextSlipNo]);
  const storageUnitName = useMemo(
    () =>
      units.find((u) => Number(u.id) === Number(selectedUnitId))?.name ??
      unitLabel ??
      "—",
    [units, selectedUnitId, unitLabel],
  );

  const settingsSummary = useMemo(
    () =>
      `Lề ${marginTop} / ${marginRight} / ${marginBottom} / ${marginLeft} cm · ${printFont.label} ${printFontSizePt}pt · Mẫu: ${formMauSo || "—"}`,
    [
      formMauSo,
      marginBottom,
      marginLeft,
      marginRight,
      marginTop,
      printFont.label,
      printFontSizePt,
    ],
  );

  useEffect(() => {
    if (selectedUnitId == null) {
      return;
    }
    if (isEditMode) {
      return;
    }
    if (skipRecipientResetAfterDraftRef.current) {
      skipRecipientResetAfterDraftRef.current = false;
      return;
    }
    setRecipientUnitId(selectedUnitId);
    setRecipientUserId("");
    setRecipientName("");
    setSignerRecipient("");
    defLoadedKey.current = null;
  }, [selectedUnitId, isEditMode]);

  useEffect(() => {
    if (formDefPayload?.unitId !== selectedUnitId) {
      return;
    }
    if (defLoadedKey.current === selectedUnitId) {
      return;
    }
    if (isEditMode) {
      defLoadedKey.current = selectedUnitId;
      return;
    }
    const d = formDefPayload.defaults;
    if (d) {
      if (d.printLine1 != null) {
        setPrintHeaderLine1(d.printLine1);
      }
      if (d.printLine2 != null) {
        setPrintHeaderLine2(d.printLine2);
      }
      if (d.formMauSo != null) {
        setFormMauSo(d.formMauSo);
      }
      if (d.warehouseFrom != null) {
        setWarehouseFrom(d.warehouseFrom);
      }
      if (d.marginTopCm != null && Number.isFinite(Number(d.marginTopCm))) {
        setMarginTop(Number(d.marginTopCm));
      }
      if (d.marginRightCm != null && Number.isFinite(Number(d.marginRightCm))) {
        setMarginRight(Number(d.marginRightCm));
      }
      if (
        d.marginBottomCm != null &&
        Number.isFinite(Number(d.marginBottomCm))
      ) {
        setMarginBottom(Number(d.marginBottomCm));
      }
      if (d.marginLeftCm != null && Number.isFinite(Number(d.marginLeftCm))) {
        setMarginLeft(Number(d.marginLeftCm));
      }
      if (d.printFontId != null && String(d.printFontId).trim() !== "") {
        setPrintFontId(String(d.printFontId));
      }
      if (
        d.printFontSizePt != null &&
        Number.isFinite(Number(d.printFontSizePt))
      ) {
        setPrintFontSizePt(
          Math.min(18, Math.max(8, Number(d.printFontSizePt))),
        );
      }
      if (d.signerWriter != null) {
        setSignerWriter(d.signerWriter);
      }
      if (d.signerApprover != null) {
        setSignerApprover(d.signerApprover);
      }
    }
    defLoadedKey.current = selectedUnitId;
  }, [formDefPayload, selectedUnitId, isEditMode]);

  useEffect(() => {
    if (recipientUnitId == null) {
      setRecipientUnitLabel("");
      return;
    }
    const u = units.find((x) => Number(x.id) === Number(recipientUnitId));
    setRecipientUnitLabel(u?.name ?? `#${recipientUnitId}`);
  }, [recipientUnitId, units]);

  /** User mặc định theo đơn vị nhận (bảng riêng) — ưu tiên hơn user trong mẫu in theo kho cấp. */
  useEffect(() => {
    if (recipientUnitId == null || !receivingDefSuccess) {
      return;
    }
    if (isEditMode) {
      return;
    }
    if (
      receivingDef != null &&
      Number(receivingDef.recipientUnitId) !== Number(recipientUnitId)
    ) {
      return;
    }
    if (skipReceivingDefAfterDraftRef.current) {
      skipReceivingDefAfterDraftRef.current = false;
      return;
    }
    if (receivingDef?.userId != null) {
      setRecipientUserId(String(receivingDef.userId));
    }
  }, [recipientUnitId, receivingDef, receivingDefSuccess, isEditMode]);

  /**
   * Tên người nhận trên form:
   * - Tạo mới: theo user đang chọn (recipientUserId) trong danh sách đơn vị nhận.
   * - Sửa phiếu: nếu DB có `recipientDisplayName` thì luôn dùng (đồng bộ khi phiếu refetch / updatedAt đổi);
   *   nếu DB trống thì lấy tên user trên phiếu, không có thì lấy user mặc định cài «Người nhận theo đơn vị nhận»;
   *   không ghi đè chữ ký người nhận nếu phiếu đã lưu signerRecipient.
   */
  useEffect(() => {
    if (recipientUnitId == null) {
      return;
    }
    if (!isEditMode) {
      if (!recipientUserId) {
        return;
      }
      const p = recipientUsers.find(
        (x) => String(x.id) === String(recipientUserId),
      );
      if (!p) {
        return;
      }
      const name = displayNameFromRecipientUserRow(p);
      setRecipientName(name);
      setSignerRecipient(name);
      return;
    }
    const slip = editingSlip;
    if (!slip) {
      return;
    }
    const dbDisplay = String(slip.recipientDisplayName ?? "").trim();
    if (dbDisplay !== "") {
      setRecipientName(dbDisplay);
      return;
    }
    let name = "";
    if (slip.recipientUserId != null) {
      const p = recipientUsers.find(
        (x) => String(x.id) === String(slip.recipientUserId),
      );
      name = displayNameFromRecipientUserRow(p);
    }
    if (
      !name &&
      receivingDefSuccess &&
      receivingDef?.userId != null &&
      Number(receivingDef.recipientUnitId) === Number(recipientUnitId)
    ) {
      const p = recipientUsers.find(
        (x) => String(x.id) === String(receivingDef.userId),
      );
      name = displayNameFromRecipientUserRow(p);
    }
    setRecipientName(name);
    const slipSigner = String(slip.signerRecipient ?? "").trim();
    if (slipSigner === "" && name) {
      setSignerRecipient(name);
    }
  }, [
    isEditMode,
    editingSlip?.id,
    editingSlip?.updatedAt,
    editingSlip?.recipientDisplayName,
    editingSlip?.recipientUserId,
    editingSlip?.signerRecipient,
    recipientUsers,
    receivingDef,
    receivingDefSuccess,
    recipientUnitId,
    recipientUserId,
  ]);

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const [createSlip, { isLoading: createBusy }] =
    useCreateLttpIssueSlipMutation();
  const [updateSlip, { isLoading: updateBusy }] =
    useUpdateLttpIssueSlipMutation();
  const [resyncSlipPrices, { isLoading: resyncBusy }] =
    useResyncLttpIssueSlipPricesMutation();

  /** Prefill state từ phiếu đang sửa; chạy lại khi cùng id nhưng phiếu refetch (updatedAt / trường nhận đổi). */
  const editHydrateSigRef = useRef(null);
  const prevEditingSlipIdRef = useRef(null);
  useEffect(() => {
    const curId = editingSlip?.id ?? null;
    if (prevEditingSlipIdRef.current != null && curId == null) {
      setSlipNote("");
    }
    prevEditingSlipIdRef.current = curId;
  }, [editingSlip]);

  useEffect(() => {
    if (!editingSlip) {
      editHydrateSigRef.current = null;
      return;
    }
    const hydrateSig = [
      editingSlip.id,
      editingSlip.updatedAt ?? editingSlip.createdAt ?? "",
      editingSlip.recipientDisplayName ?? "",
      editingSlip.recipientUserId ?? "",
      editingSlip.recipientUnitId ?? "",
      editingSlip.signerRecipient ?? "",
    ].join("|");
    if (editHydrateSigRef.current === hydrateSig) {
      return;
    }
    editHydrateSigRef.current = hydrateSig;
    setIssueDate(editingSlip.issueDate);
    setRecipientUnitId(
      editingSlip.recipientUnitId != null
        ? Number(editingSlip.recipientUnitId)
        : selectedUnitId,
    );
    setRecipientUserId(
      editingSlip.recipientUserId != null
        ? String(editingSlip.recipientUserId)
        : "",
    );
    if (editingSlip.printLine1 != null) {
      setPrintHeaderLine1(editingSlip.printLine1);
    }
    if (editingSlip.printLine2 != null) {
      setPrintHeaderLine2(editingSlip.printLine2);
    }
    if (editingSlip.formMauSo != null) {
      setFormMauSo(editingSlip.formMauSo);
    }
    if (editingSlip.warehouseFrom != null) {
      setWarehouseFrom(editingSlip.warehouseFrom);
    }
    if (editingSlip.signerWriter != null) {
      setSignerWriter(editingSlip.signerWriter);
    }
    setSignerRecipient(
      editingSlip.signerRecipient != null
        ? String(editingSlip.signerRecipient)
        : "",
    );
    if (editingSlip.signerApprover != null) {
      setSignerApprover(editingSlip.signerApprover);
    }
    setSlipNote(editingSlip.note != null ? String(editingSlip.note) : "");
    const lineRows = (editingSlip.lines ?? []).map(rowFromSlipLine);
    setRows(lineRows.length ? lineRows : [newEmptyRow()]);
  }, [editingSlip, selectedUnitId]);

  /** Ghi nháp vào sessionStorage (debounce) — chỉ tab tạo mới và khi được phép chỉnh. */
  useEffect(() => {
    if (
      isEditMode ||
      !selectedUnitId ||
      !canWrite ||
      !draftPersistAllowedRef.current
    ) {
      return undefined;
    }
    const handle = window.setTimeout(() => {
      writeIssueSlipDraft(selectedUnitId, {
        issueDate,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        printFontId,
        printFontSizePt,
        printHeaderLine1,
        printHeaderLine2,
        formMauSo,
        recipientName,
        recipientUnitId,
        recipientUserId,
        warehouseFrom,
        signerWriter,
        signerRecipient,
        signerApprover,
        slipNote,
        rows: rows.map((r) => ({
          key: r.key,
          commodityId: r.commodityId,
          codeDraft: r.codeDraft,
          lttpSupplierId: r.lttpSupplierId,
          requiredQuantity: r.requiredQuantity,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          tgsxPrice: r.tgsxPrice,
          lineNote: r.lineNote ?? "",
        })),
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [
    isEditMode,
    selectedUnitId,
    canWrite,
    issueDate,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    printFontId,
    printFontSizePt,
    printHeaderLine1,
    printHeaderLine2,
    formMauSo,
    recipientName,
    recipientUnitId,
    recipientUserId,
    warehouseFrom,
    signerWriter,
    signerRecipient,
    signerApprover,
    slipNote,
    rows,
  ]);

  const discardIssueSlipDraft = useCallback(() => {
    if (selectedUnitId == null) {
      return;
    }
    clearIssueSlipDraft(selectedUnitId);
    setDraftNotice(false);
    setIssueDate(localYmd());
    setRows([newEmptyRow()]);
    setRecipientUserId("");
    setRecipientName("");
    setSignerRecipient("");
    setRecipientUnitId(Number(selectedUnitId));
    setSlipNote("");
    defLoadedKey.current = null;
    skipReceivingDefAfterDraftRef.current = false;
  }, [selectedUnitId]);

  const applyRowPatch = useCallback((key, patch) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) {
        return prev;
      }
      const merged = { ...prev[idx], ...patch };
      const next = prev.map((r, j) => (j === idx ? merged : r));
      if (idx === next.length - 1 && isRowCompleteForSubmit(merged)) {
        return [...next, newEmptyRow()];
      }
      return next;
    });
  }, []);

  const focusRowQuantity = useCallback((key) => {
    queueMicrotask(() => {
      const el = rowQtyRefs.current[key];
      if (el) {
        el.focus();
        if (typeof el.select === "function") {
          el.select();
        }
      }
    });
  }, []);

  const onPickCommodity = useCallback(
    (key, commodityIdStr) => {
      const id = Number(commodityIdStr);
      if (!Number.isInteger(id) || id <= 0) {
        applyRowPatch(key, {
          commodityId: "",
          codeDraft: "",
          lttpSupplierId: "",
          unitPrice: null,
          tgsxPrice: null,
          lineNote: "",
        });
        return;
      }
      const hit = priceByCommodityId.get(id);
      const c = comById.get(id);
      flushSync(() => {
        applyRowPatch(key, {
          commodityId: id,
          codeDraft: c?.code ?? "",
          lttpSupplierId:
            c?.defaultLttpSupplier?.id != null
              ? String(c.defaultLttpSupplier.id)
              : "",
          unitPrice: hit?.unitPrice ?? null,
          tgsxPrice: hit?.tgsxPrice ?? null,
        });
      });
      focusRowQuantity(key);
    },
    [applyRowPatch, comById, focusRowQuantity, priceByCommodityId],
  );

  const resolveByCode = useCallback(
    async (key, codeDraft, { silent = false, focusQuantity = false } = {}) => {
      if (!selectedUnitId) {
        if (!silent) {
          notifyError("Chưa chọn đơn vị.");
        }
        return;
      }
      const code = String(codeDraft ?? "").trim();
      if (!code) {
        return;
      }
      try {
        const d = await apiRequest({
          url: "/lttp/issue-slips/resolve",
          method: "get",
          params: { unitId: selectedUnitId, date: issueDate, code },
        });
        const c = d?.commodity;
        if (!c?.id) {
          throw new Error("Phản hồi không hợp lệ");
        }
        flushSync(() => {
          applyRowPatch(key, {
            commodityId: c.id,
            codeDraft: c.code,
            lttpSupplierId:
              d?.commodity?.defaultLttpSupplier?.id != null
                ? String(d.commodity.defaultLttpSupplier.id)
                : "",
            unitPrice: d.unitPrice,
            tgsxPrice: d.tgsxPrice,
          });
        });
        if (focusQuantity) {
          focusRowQuantity(key);
        }
        const missingPrice =
          d?.missingEffectivePrice === true ||
          d?.unitPrice == null ||
          (typeof d.unitPrice === "number" && !Number.isFinite(d.unitPrice));
        if (!missingPrice && !silent) {
          notifySuccess("Đã lấy giá theo ngày.");
        } else if (missingPrice && focusQuantity) {
          notifyWarning(
            "Đã nhận mặt hàng nhưng chưa có đơn giá tại ngày phiếu trong bảng giá LTTP — cập nhật bảng giá hiệu lực hoặc import bảng giá (Excel) để có giá và lưu phiếu.",
          );
        }
      } catch (err) {
        if (!silent) {
          notifyError(
            err?.data?.message || err?.message || "Không tra được mã / giá.",
          );
        }
      }
    },
    [applyRowPatch, focusRowQuantity, issueDate, selectedUnitId],
  );

  const lineTotal = useCallback((r) => {
    if (r.unitPrice == null) {
      return 0;
    }
    const q = parsePositiveDecimalField(r.quantity);
    const p = Number(r.unitPrice);
    if (!Number.isFinite(q) || !Number.isFinite(p)) {
      return 0;
    }
    return Math.round(q * p * 100) / 100;
  }, []);

  /** Trùng mặt hàng trong phiếu (cùng commodityId ≥ 2 dòng) — khớp lỗi BE «Trùng mặt hàng trong phiếu». */
  const commodityIdsDuplicatedInForm = useMemo(() => {
    const counts = new Map();
    for (const r of rows) {
      if (r.commodityId === "" || r.commodityId == null) {
        continue;
      }
      const cid = Number(r.commodityId);
      if (!Number.isInteger(cid) || cid <= 0) {
        continue;
      }
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    const dup = new Set();
    for (const [cid, n] of counts) {
      if (n > 1) {
        dup.add(cid);
      }
    }
    return dup;
  }, [rows]);

  const isDuplicateCommodityRow = useCallback(
    (r) => {
      if (r.commodityId === "" || r.commodityId == null) {
        return false;
      }
      const cid = Number(r.commodityId);
      if (!Number.isInteger(cid) || cid <= 0) {
        return false;
      }
      return commodityIdsDuplicatedInForm.has(cid);
    },
    [commodityIdsDuplicatedInForm],
  );

  const hasDuplicateCommodityInForm = commodityIdsDuplicatedInForm.size > 0;

  const dataRows = useMemo(() => rows.filter(isRowCompleteForSubmit), [rows]);

  const formTotal = useMemo(
    () => dataRows.reduce((s, r) => s + lineTotal(r), 0),
    [dataRows, lineTotal],
  );

  const totalInWords = useMemo(
    () => vndToVietnameseDocumentLine(formTotal),
    [formTotal],
  );

  const removeRow = useCallback((key) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [newEmptyRow()];
      }
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  async function handlePrint() {
    if (!isEditMode || !editingSlip?.id) {
      notifyWarning(
        "Hãy lưu phiếu trước, sau đó mở lại ở chế độ sửa để xuất PDF chính xác.",
      );
      return;
    }
    try {
      const resp = await httpClient({
        url: `/lttp/issue-slips/${editingSlip.id}/print-pdf`,
        method: "get",
        responseType: "blob",
      });
      const blob = resp?.data;
      if (!(blob instanceof Blob)) {
        notifyError("Không lấy được file PDF.");
        return;
      }
      const pdfUrl = URL.createObjectURL(blob);
      const popup = window.open(pdfUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      notifySuccess("Đã mở bản PDF phiếu xuất.");
    } catch (err) {
      notifyError(
        err?.response?.data?.message ||
          err?.data?.message ||
          err?.message ||
          "Không xuất được PDF.",
      );
    }
  }

  async function onSubmit(e) {
    e?.preventDefault();
    if (!selectedUnitId) {
      notifyError("Chưa chọn đơn vị.");
      return;
    }
    const toSave = rows.filter(isRowCompleteForSubmit);
    if (!toSave.length) {
      notifyError(
        "Cần ít nhất một dòng hợp lệ (mặt hàng, đối tác, đơn giá, số lượng thực xuất > 0).",
      );
      return;
    }
    const lines = [];
    for (const r of toSave) {
      const reqRaw = r.requiredQuantity;
      const reqNum =
        reqRaw !== "" && reqRaw != null && String(reqRaw).trim() !== ""
          ? parsePositiveDecimalField(reqRaw)
          : null;
      const noteTrim =
        r.lineNote != null && String(r.lineNote).trim() !== ""
          ? String(r.lineNote).trim().slice(0, 500)
          : null;
      lines.push({
        commodityId: Number(r.commodityId),
        quantity: parsePositiveDecimalField(r.quantity),
        requiredQuantity:
          reqNum != null && Number.isFinite(reqNum) && reqNum >= 0
            ? reqNum
            : null,
        lttpSupplierId: Number(r.lttpSupplierId),
        lineNote: noteTrim,
      });
    }
    const uniqueCids = new Set(lines.map((ln) => ln.commodityId));
    if (uniqueCids.size !== lines.length) {
      notifyError("Trùng mặt hàng trong phiếu — mỗi mặt hàng chỉ một dòng.");
      return;
    }
    const noteTrim =
      slipNote != null && String(slipNote).trim() !== ""
        ? String(slipNote).trim().slice(0, 500)
        : null;
    const sharedPayload = {
      note: noteTrim,
      lines,
      recipientUnitId: recipientUnitId ?? selectedUnitId,
      recipientUserId: recipientUserId ? Number(recipientUserId) : null,
      recipientDisplayName: recipientName?.trim() || null,
      printLine1: printHeaderLine1?.trim() || null,
      printLine2: printHeaderLine2?.trim() || null,
      formMauSo: formMauSo?.trim() || null,
      warehouseFrom: warehouseFrom?.trim() || null,
      signerWriter: signerWriter?.trim() || null,
      signerRecipient: signerRecipient?.trim() || null,
      signerApprover: signerApprover?.trim() || null,
    };
    try {
      if (isEditMode) {
        await updateSlip({ id: editingSlip.id, ...sharedPayload });
        notifySuccess("Đã cập nhật phiếu xuất.");
        if (typeof onUpdated === "function") {
          onUpdated();
        }
        return;
      }
      await createSlip({
        unitId: selectedUnitId,
        issueDate,
        ...sharedPayload,
      });
      notifySuccess("Đã lưu phiếu xuất.");
      clearIssueSlipDraft(selectedUnitId);
      setDraftNotice(false);
      setRows([newEmptyRow()]);
      refetchNextSerial();
    } catch (err) {
      notifyError(
        err?.data?.message || err?.message || "Lưu không thành công.",
      );
    }
  }

  async function onResyncSlipPricesFromEffectiveTable() {
    if (!editingSlip?.id) {
      return;
    }
    try {
      const slip = await resyncSlipPrices({ id: editingSlip.id }).unwrap();
      const lineRows = (slip?.lines ?? []).map(rowFromSlipLine);
      setRows(lineRows.length ? lineRows : [newEmptyRow()]);
      notifySuccess(
        "Đã cập nhật đơn giá các dòng theo bảng giá hiệu lực tại ngày phiếu.",
      );
    } catch (err) {
      notifyError(
        err?.data?.message || err?.message || "Không đồng bộ được đơn giá.",
      );
    }
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="print:hidden space-y-3">
        {isEditMode ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-[11px] text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">
                Đang sửa phiếu — Quyển{" "}
                <span className="font-mono">{editingSlip?.bookMmyy}</span> — Số{" "}
                <span className="font-mono">
                  {editingSlip?.slipNo != null
                    ? String(editingSlip.slipNo).padStart(4, "0")
                    : "—"}
                </span>{" "}
                · ngày{" "}
                <span className="font-mono">{editingSlip?.issueDate}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canWrite ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs"
                  disabled={resyncBusy || updateBusy || !selectedUnitId}
                  onClick={() => void onResyncSlipPricesFromEffectiveTable()}
                >
                  {resyncBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-3.5" aria-hidden />
                  )}
                  Đồng bộ đơn giá
                </Button>
              ) : null}
              {typeof onCancelEdit === "function" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={onCancelEdit}
                >
                  <X className="size-3.5" />
                  Hủy sửa
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {!isEditMode && draftNotice && canWrite ? (
          <div className="flex flex-col gap-2 rounded-lg border border-sky-400/50 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-950 dark:border-sky-600/50 dark:bg-sky-950/35 dark:text-sky-50 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0">
              <span className="font-medium">Đã khôi phục nháp phiếu</span> từ
              phiên làm việc trước.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-8 shrink-0 text-xs text-sky-900 underline-offset-2 hover:underline dark:text-sky-100"
              onClick={() => discardIssueSlipDraft()}
            >
              Xóa nháp
            </Button>
          </div>
        ) : null}
        <p className="text-[11px] leading-snug text-muted-foreground">
          {unitLabel ? (
            <span>
              Đơn vị:{" "}
              <span className="font-medium text-foreground">{unitLabel}</span>
            </span>
          ) : null}
        </p>

        <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card/30 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              Cài đặt mẫu in
            </p>
            <p className="text-[11px] leading-relaxed text-foreground">
              {settingsSummary}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-8 w-full shrink-0 gap-1.5 text-xs sm:w-auto"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-3.5" />
            Mở cài đặt
          </Button>
        </div>
      </div>

      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
            aria-label="Đóng"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lttp-px-settings-title"
            className="relative flex max-h-dvh w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-lg sm:max-h-[42rem] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-card px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0 space-y-0.5">
                <p
                  id="lttp-px-settings-title"
                  className="text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  Cài đặt phiếu xuất
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={() => setSettingsOpen(false)}
              >
                Đóng
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">
                Tuỳ chọn bản in
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-[10px] text-muted-foreground">
                  Lề trên (cm)
                  <input
                    type="number"
                    step="0.1"
                    className={cn(inputClass, "mt-0.5")}
                    value={marginTop}
                    onChange={(e) => setMarginTop(Number(e.target.value))}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Lề phải (cm)
                  <input
                    type="number"
                    step="0.1"
                    className={cn(inputClass, "mt-0.5")}
                    value={marginRight}
                    onChange={(e) => setMarginRight(Number(e.target.value))}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Lề dưới (cm)
                  <input
                    type="number"
                    step="0.1"
                    className={cn(inputClass, "mt-0.5")}
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(Number(e.target.value))}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Lề trái (cm)
                  <input
                    type="number"
                    step="0.1"
                    className={cn(inputClass, "mt-0.5")}
                    value={marginLeft}
                    onChange={(e) => setMarginLeft(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">
                  Mẫu in phiếu (PDF)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-muted-foreground">
                    Dòng 1 (đầu trái, vd. đơn vị cấp trên)
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={printHeaderLine1}
                      onChange={(e) => setPrintHeaderLine1(e.target.value)}
                      placeholder="VD: TRUNG ĐOÀN …"
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Dòng 2 (đầu trái)
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={printHeaderLine2}
                      onChange={(e) => setPrintHeaderLine2(e.target.value)}
                      placeholder="VD: QUÂN NHU"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-muted-foreground">
                    Font chữ
                    <select
                      className={cn(inputClass, "mt-0.5")}
                      value={printFontId}
                      onChange={(e) => setPrintFontId(e.target.value)}
                    >
                      {FONT_CHOICES.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Cỡ chữ in (pt)
                    <input
                      type="number"
                      min={8}
                      max={18}
                      className={cn(inputClass, "mt-0.5")}
                      value={printFontSizePt}
                      onChange={(e) => setPrintFontSizePt(Number(e.target.value))}
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-muted-foreground">
                    Mẫu số (góc phải)
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={formMauSo}
                      onChange={(e) => setFormMauSo(e.target.value)}
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Nhận tại kho
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={warehouseFrom}
                      onChange={(e) => setWarehouseFrom(e.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-muted-foreground">
                    Người viết phiếu (ký)
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={signerWriter}
                      onChange={(e) => setSignerWriter(e.target.value)}
                    />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Người duyệt (ký)
                    <input
                      className={cn(inputClass, "mt-0.5")}
                      value={signerApprover}
                      onChange={(e) => setSignerApprover(e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-[9px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Dữ liệu giá &amp; mặt hàng</span> tự theo{" "}
                  <span className="font-medium text-foreground">đơn vị cấp</span> (hiện: {storageUnitName}).
                </p>
                <p className="text-[9px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Quyển số</span>{" "}
                  <span className="font-mono text-foreground">{bookMmyyDisplay}</span> theo «Ngày phiếu»;{" "}
                  <span className="font-medium text-foreground">Số phiếu</span> kế tiếp:{" "}
                  <span className="font-mono text-foreground">{nextSlipNoDisplay}</span> (khi bấm Lưu phiếu).
                </p>
                <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    disabled={!canWrite || !selectedUnitId || putDefBusy}
                    onClick={async () => {
                      if (!selectedUnitId) {
                        return;
                      }
                      try {
                        await putFormDefaults({
                          unitId: selectedUnitId,
                          printLine1: printHeaderLine1,
                          printLine2: printHeaderLine2,
                          formMauSo,
                          warehouseFrom,
                          marginTopCm: marginTop,
                          marginRightCm: marginRight,
                          marginBottomCm: marginBottom,
                          marginLeftCm: marginLeft,
                          printFontId,
                          printFontSizePt,
                          signerWriter,
                          signerApprover,
                        });
                        notifySuccess("Đã lưu cấu hình mẫu in theo đơn vị.");
                        setSettingsOpen(false);
                      } catch (err) {
                        notifyError(
                          err?.data?.message ||
                            err?.message ||
                            "Lưu mẫu in không thành công.",
                        );
                      }
                    }}
                  >
                    {putDefBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Lưu cấu hình mẫu in
                  </Button>
                  <p className="text-[9px] text-muted-foreground">
                    Ghi lại mẫu số, kho, chữ ký cho lần sau.
                  </p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">
                Bản in dùng mẫu phiếu xuất kho (cột số: nghìn «.», thập phân
                «,»).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <form
        id={formId}
        className="print:hidden space-y-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[10rem] space-y-0.5 text-xs">
            Ngày phiếu{isEditMode ? " (không đổi)" : ""}
            <input
              type="date"
              className={cn(
                inputClass,
                "mt-0.5 block",
                isEditMode ? "cursor-not-allowed opacity-70" : "",
              )}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              disabled={isEditMode}
              readOnly={isEditMode}
              title={isEditMode ? "Ngày phiếu giữ nguyên khi sửa." : undefined}
            />
          </label>
          {canPickUnits && units.length > 0 ? (
            <label className="min-w-[16rem] flex-1 space-y-0.5 text-xs">
              Đơn vị nhận LTTP
              <select
                className={cn(inputClass, "mt-0.5 block")}
                value={String(recipientUnitId ?? "")}
                onChange={(e) => {
                  setRecipientUserId("");
                  setRecipientName("");
                  setSignerRecipient("");
                  setRecipientUnitId(Number(e.target.value));
                }}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? `Đơn vị #${u.id}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="min-w-[14rem] flex-1 rounded-lg border border-dashed border-border/70 px-2 py-1.5 text-[10px] text-muted-foreground">
              Đơn vị nhận:{" "}
              <span className="font-medium text-foreground">
                {recipientUnitLabel || "—"}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            onClick={handlePrint}
          >
            <Printer className="size-3.5" />
            In / PDF
          </Button>
        </div>
        <label className="block space-y-0.5 text-xs">
          Chú thích phiếu (chỉ dùng trên tab Đặt hàng để phân biệt phiếu — không
          in trên phiếu xuất)
          <textarea
            className={cn(inputClass, "mt-0.5 min-h-[2.5rem] resize-y")}
            rows={2}
            maxLength={500}
            value={slipNote}
            onChange={(e) => setSlipNote(e.target.value)}
            placeholder="Ví dụ: bữa trưa 28/4, ca 1…"
            disabled={!canWrite}
          />
        </label>
        <p className="text-[10px] text-muted-foreground">
          Bảng giá theo đơn vị cấp, tham chiếu ngày:{" "}
          {eff?.appliedEffectiveDate ?? "—"}{" "}
          {eLoad ? (
            <Loader2 className="ml-1 inline size-3 animate-spin" />
          ) : null}
          <span className="text-foreground/80">
            {" "}
            — Số lượng: nhập thập phân (ví dụ 1,5 hoặc 0,25).
          </span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/90">Đối tác:</span> gợi ý
          từ cột &quot;Đối tác mặc định&quot; từng mặt hàng (quản trị LTTP); mỗi
          dòng phải chọn đối tác trước khi lưu (chưa cấp theo mặt hàng thì chọn
          thủ công).
        </p>
        {hasDuplicateCommodityInForm ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-[11px] font-medium leading-snug text-destructive dark:bg-destructive/20">
            Trùng mặt hàng trong phiếu — các dòng tô đỏ có cùng một mặt hàng;
            chỉ giữ một dòng cho mỗi mặt hàng hoặc đổi mặt hàng trước khi lưu.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[64rem] border-collapse text-left text-[11px]">
            <thead className="bg-secondary/90">
              <tr className="border-b border-border text-[9px] uppercase text-muted-foreground">
                <th className="w-8 px-1 py-1.5" rowSpan={2}>
                  STT
                </th>
                <th className="min-w-[9rem] px-1 py-1.5" rowSpan={2}>
                  Tên, quy cách (mặt hàng)
                </th>
                <th className="min-w-[7rem] px-1 py-1.5" rowSpan={2}>
                  Đối tác
                </th>
                <th className="w-20 px-1 py-1.5" rowSpan={2}>
                  Mã
                </th>
                <th className="w-12 px-1 py-1.5" rowSpan={2}>
                  ĐVT
                </th>
                <th className="w-32 px-1 py-1 text-center" colSpan={2}>
                  Số lượng
                </th>
                <th className="w-24 px-1 py-1.5 text-right" rowSpan={2}>
                  Đơn giá
                </th>
                <th className="w-20 px-1 py-1.5 text-right" rowSpan={2}>
                  TGSX
                </th>
                <th className="w-28 px-1 py-1.5 text-right" rowSpan={2}>
                  Thành tiền
                </th>
                <th className="min-w-[5rem] px-1 py-1.5" rowSpan={2}>
                  Ghi chú
                </th>
                <th className="w-12 px-1 py-1.5" rowSpan={2} />
              </tr>
              <tr className="border-b border-border text-[8px] uppercase text-muted-foreground">
                <th className="w-16 px-1 py-1.5">Yêu cầu</th>
                <th className="w-16 px-1 py-1.5">Thực xuất</th>
              </tr>
            </thead>
            <tbody>
              {cLoad ? (
                <tr>
                  <td colSpan={12} className="px-2 py-3 text-muted-foreground">
                    Đang tải danh mục mặt hàng…
                  </td>
                </tr>
              ) : null}
              {rows.map((r, i) => {
                const c = r.commodityId ? comById.get(r.commodityId) : null;
                const commoditySelectedLabel = c ? `${c.name} (${c.code})` : "";
                const dupRow = isDuplicateCommodityRow(r);
                return (
                  <tr
                    key={r.key}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      dupRow &&
                        "border-l-[3px] border-l-red-600 bg-red-500/12 dark:border-l-red-400 dark:bg-red-950/35",
                    )}
                    title={
                      dupRow
                        ? "Trùng mặt hàng trong phiếu — mỗi mặt hàng chỉ một dòng."
                        : undefined
                    }
                  >
                    <td
                      className={cn(
                        "px-1 py-1 text-[10px] text-muted-foreground",
                        dupRow && "text-red-900 dark:text-red-100/95",
                      )}
                    >
                      {i + 1}
                    </td>
                    <td className="px-1 py-1.5 align-top">
                      <IssueSlipCommoditySearch
                        rowKey={r.key}
                        commodityId={r.commodityId}
                        selectedLabel={commoditySelectedLabel}
                        commodities={commodities}
                        dupRow={dupRow}
                        inputClass={inputClass}
                        disabled={!canWrite}
                        onPickCommodity={onPickCommodity}
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        className={cn(
                          inputClass,
                          dupRow && "border-red-500/90 dark:border-red-400/80",
                        )}
                        value={
                          r.lttpSupplierId === "" || r.lttpSupplierId == null
                            ? ""
                            : String(r.lttpSupplierId)
                        }
                        onChange={(e) =>
                          applyRowPatch(r.key, {
                            lttpSupplierId: e.target.value,
                          })
                        }
                      >
                        <option value="">—</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        ref={(el) => {
                          rowCodeRefs.current[r.key] = el;
                        }}
                        className={cn(
                          inputClass,
                          "font-mono text-[10px]",
                          dupRow && "border-red-500/90 dark:border-red-400/80",
                        )}
                        value={r.codeDraft}
                        onChange={(e) =>
                          applyRowPatch(r.key, { codeDraft: e.target.value })
                        }
                        onBlur={() =>
                          resolveByCode(r.key, r.codeDraft, { silent: true })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void resolveByCode(r.key, r.codeDraft, {
                              silent: true,
                              focusQuantity: true,
                            });
                          }
                        }}
                        placeholder="Mã, Enter"
                      />
                    </td>
                    <td
                      className={cn(
                        "px-1 py-1 text-[10px] text-muted-foreground",
                        dupRow && "text-red-900/90 dark:text-red-100/90",
                      )}
                    >
                      {c?.measureUnit ?? "—"}
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={cn(
                          inputClass,
                          dupRow && "border-red-500/90 dark:border-red-400/80",
                        )}
                        value={r.requiredQuantity}
                        onChange={(e) =>
                          applyRowPatch(r.key, {
                            requiredQuantity: e.target.value,
                          })
                        }
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        ref={(el) => {
                          rowQtyRefs.current[r.key] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        className={cn(
                          inputClass,
                          dupRow && "border-red-500/90 dark:border-red-400/80",
                        )}
                        value={quantityInputDisplay(r.quantity)}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(
                            /[^\d.,]/g,
                            "",
                          );
                          applyRowPatch(r.key, { quantity: cleaned });
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") {
                            return;
                          }
                          e.preventDefault();
                          const idx = rows.findIndex((x) => x.key === r.key);
                          if (idx < 0) {
                            return;
                          }
                          if (idx < rows.length - 1) {
                            const nextKey = rows[idx + 1].key;
                            queueMicrotask(() =>
                              rowCodeRefs.current[nextKey]?.focus(),
                            );
                            return;
                          }
                          const nr = newEmptyRow();
                          flushSync(() => {
                            setRows((prev) => [...prev, nr]);
                          });
                          queueMicrotask(() =>
                            rowCodeRefs.current[nr.key]?.focus(),
                          );
                        }}
                      />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-1 py-1 text-right tabular-nums text-[10px]",
                        dupRow && "text-red-950 dark:text-red-50/95",
                      )}
                    >
                      {r.unitPrice != null ? formatVnd(r.unitPrice) : "—"}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-1 py-1 text-right tabular-nums text-[9px] text-muted-foreground",
                        dupRow && "text-red-900/90 dark:text-red-200/85",
                      )}
                    >
                      {r.tgsxPrice != null ? formatVnd(r.tgsxPrice) : "—"}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-1 py-1 text-right tabular-nums text-[10px]",
                        dupRow && "text-red-950 dark:text-red-50/95",
                      )}
                    >
                      {formatVnd(lineTotal(r))}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        className={cn(
                          inputClass,
                          "text-[10px]",
                          dupRow && "border-red-500/90 dark:border-red-400/80",
                        )}
                        value={r.lineNote ?? ""}
                        onChange={(e) =>
                          applyRowPatch(r.key, { lineNote: e.target.value })
                        }
                        placeholder="—"
                      />
                    </td>
                    <td className="px-0 py-1 text-right">
                      <div className="flex justify-end gap-0.5">
                        <IconButton
                          type="button"
                          label="Xóa dòng"
                          variant="ghost"
                          onClick={() => removeRow(r.key)}
                          className="h-7"
                        >
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td
                  colSpan={9}
                  className="px-2 py-2 text-right text-[10px] font-bold"
                >
                  TỔNG CỘNG
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold tabular-nums">
                  {formatVnd(formTotal)}
                </td>
                <td className="px-2" />
                <td />
              </tr>
              <tr>
                <td
                  colSpan={12}
                  className="px-2 py-2 text-[10px] italic leading-relaxed text-foreground/90"
                >
                  Tổng số tiền (Viết bằng chữ): {totalInWords || "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="gap-1.5 text-xs"
              disabled={
                createBusy || updateBusy || resyncBusy || !selectedUnitId
              }
              onClick={() => void onSubmit()}
            >
              {createBusy || updateBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {isEditMode ? "Cập nhật phiếu" : "Lưu phiếu xuất"}
            </Button>
            {isEditMode && typeof onCancelEdit === "function" ? (
              <Button
                type="button"
                variant="secondary"
                className="gap-1.5 text-xs"
                disabled={updateBusy}
                onClick={onCancelEdit}
              >
                <X className="size-3.5" />
                Hủy
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Bạn không có quyền lập/sửa/xóa phiếu (cần lttp.issue-slips.write).
          </p>
        )}
      </form>
    </div>
  );
}
