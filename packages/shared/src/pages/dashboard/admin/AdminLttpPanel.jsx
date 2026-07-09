import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  useCreateLttpCommodityMutation,
  useCreateLttpFoodGroupMutation,
  useCreateLttpPriceTableMutation,
  useCreateLttpSupplierMutation,
  useDeleteLttpCommodityMutation,
  useDeleteLttpFoodGroupMutation,
  useDeleteLttpPriceTableMutation,
  useDeleteLttpSupplierMutation,
  useGetLttpCommoditiesQuery,
  useGetLttpSuppliersQuery,
  useGetLttpEffectivePricesQuery,
  useGetLttpFoodGroupsCatalogQuery,
  useGetLttpFoodGroupsQuery,
  useGetLttpPriceTablesQuery,
  useImportLttpPriceTableMutation,
  usePatchLttpCommodityMutation,
  usePatchLttpFoodGroupMutation,
  usePatchLttpSupplierMutation,
  usePutLttpCommodityDefaultSupplierMutation,
} from "@/features/lttp/api/lttpApi";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { resolveDefaultLttpStorageUnitId, LTTP_STORAGE_UNIT_NAME } from "@/pages/lttpNhapXuat/lttpStorageUnitDefault";
import { DASHBOARD_LTTP_SUB_ACCESS_KEY } from "@/features/route-access/routeAccessRegistry";
import { GuardedNavLink } from "@/hocs/GuardedNavLink";
import { ResponsiveTableWrap, ScrollableHorizontalStrip } from "@/components/common/ScrollableHorizontalStrip";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import httpClient from "@/services/httpClient";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { formatVnd } from "@/utils/formatVnd";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

/** Ẩn nút tăng/giảm của `type="number"` (Chrome / Edge / Safari). */
const noSpinnerNumClass =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Tham chiếu cố định khi RTK Query chưa có `data` / bị skip — tránh `useEffect(..., [data])` lặp vô hạn. */
const RTK_EMPTY_ARRAY = [];

const P = {
  C_READ: "lttp.commodities.read",
  C_WRITE: "lttp.commodities.write",
  P_READ: "lttp.prices.read",
  P_WRITE: "lttp.prices.write",
  G_READ: "lttp.groups.read",
};

const OTHER_CODE = "other";

/** Ô «mới» coi như chưa gõ — cho phép điền mặc định khi API giá theo ngày áp dụng tải xong. */
function isPtRowNewPricesBlank(old) {
  if (!old) {
    return false;
  }
  const up = old.unitPrice;
  const upBlank = up === "" || up == null || up === 0 || up === "0";
  const tg = old.tgsxPrice;
  const tgBlank = tg == null || tg === "" || tg === "0";
  return upBlank && tgBlank;
}

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {{ replace?: boolean }} [navOptions] — khi `onSubNavigate` bật, truyền cho `navigate(..., { replace })`.
 */
export function AdminLttpPanel({
  user,
  allowUnitPick = false,
  groupsOnly = false,
  routeSub = null,
  onSubNavigate = null,
}) {
  const { confirm } = useConfirm();
  const { workingUnitId } = useTargetUnitScope();
  const isRouteDriven = typeof onSubNavigate === "function";
  const canReadUnits = useHasPermission(PERMISSIONS.UNITS_READ);
  const canPickAnyUnit = allowUnitPick || canReadUnits;
  const canManageLttpGroups = useHasPermission(PERMISSIONS.LTTP_GROUPS_MANAGE);
  const canCRead = useHasPermission(P.C_READ);
  const canCWrite = useHasPermission(P.C_WRITE);
  const canPRead = useHasPermission(P.P_READ);
  const canPWrite = useHasPermission(P.P_WRITE);
  const canGRead = useHasPermission(P.G_READ);

  const { data: foodGroupsData } = useGetLttpFoodGroupsQuery(undefined, {
    skip: !canGRead,
  });
  const foodGroups = foodGroupsData ?? RTK_EMPTY_ARRAY;
  const { data: foodGroupsCatalogData, isLoading: fgCatLoad } = useGetLttpFoodGroupsCatalogQuery(undefined, {
    skip: !canManageLttpGroups,
  });
  const foodGroupsCatalog = foodGroupsCatalogData ?? RTK_EMPTY_ARRAY;

  const { data: unitsData } = useGetUnitsQuery(undefined, {
    skip: groupsOnly || !canPickAnyUnit,
  });
  const units = unitsData ?? RTK_EMPTY_ARRAY;
  const sortedUnits = useMemo(
    () => sortUnitsByPath(!groupsOnly && canPickAnyUnit ? units : []),
    [units, canPickAnyUnit, groupsOnly],
  );

  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;

  const selectedUnitId = useMemo(() => {
    if (groupsOnly) {
      return null;
    }
    if (!canPickAnyUnit) {
      return defaultUnitId;
    }
    if (workingUnitId != null) {
      return Number(workingUnitId);
    }
    const fallback = sortedUnits.length ? sortedUnits[0].id : defaultUnitId;
    const storage = sortedUnits.find((u) => String(u.name ?? "") === LTTP_STORAGE_UNIT_NAME);
    if (storage) {
      return Number(storage.id);
    }
    return resolveDefaultLttpStorageUnitId(sortedUnits, fallback);
  }, [groupsOnly, canPickAnyUnit, workingUnitId, sortedUnits, defaultUnitId]);

  const selectedUnitLabel = useMemo(() => {
    if (selectedUnitId == null) {
      return null;
    }
    if (!canPickAnyUnit && user?.unit?.id != null && Number(user.unit.id) === Number(selectedUnitId)) {
      return user.unit.name ?? `#${selectedUnitId}`;
    }
    return sortedUnits.find((u) => Number(u.id) === Number(selectedUnitId))?.name ?? `#${selectedUnitId}`;
  }, [selectedUnitId, canPickAnyUnit, user?.unit, sortedUnits]);

  const [subInternal, setSubInternal] = useState("commodities");
  const sub =
    isRouteDriven && !groupsOnly ? (routeSub && routeSub.length ? routeSub : "commodities") : subInternal;

  const setSub = useCallback(
    (nextId, navOptions) => {
      if (isRouteDriven && !groupsOnly) {
        onSubNavigate(nextId, navOptions);
      } else {
        setSubInternal(nextId);
      }
    },
    [isRouteDriven, groupsOnly, onSubNavigate],
  );

  const [effectiveDate, setEffectiveDate] = useState(() => localYmd());

  const { data: commoditiesData, isLoading: cLoad } = useGetLttpCommoditiesQuery(selectedUnitId, {
    skip: !selectedUnitId || !canCRead,
  });
  const commodities = commoditiesData ?? RTK_EMPTY_ARRAY;
  const { data: suppliersData, isLoading: supLoad } = useGetLttpSuppliersQuery(selectedUnitId, {
    skip: !selectedUnitId || !canCRead,
  });
  const suppliers = suppliersData ?? RTK_EMPTY_ARRAY;
  const { data: priceTablesData, isLoading: tLoad } = useGetLttpPriceTablesQuery(
    { unitId: selectedUnitId },
    { skip: !selectedUnitId || !canPRead },
  );
  const priceTables = priceTablesData ?? RTK_EMPTY_ARRAY;
  const { data: effectiveData, isLoading: eLoad } = useGetLttpEffectivePricesQuery(
    { unitId: selectedUnitId, date: effectiveDate },
    { skip: !selectedUnitId || !canPRead },
  );

  const [createCommodity] = useCreateLttpCommodityMutation();
  const [patchCommodity] = usePatchLttpCommodityMutation();
  const [deleteCommodity] = useDeleteLttpCommodityMutation();
  const [createPriceTable] = useCreateLttpPriceTableMutation();
  const [deletePriceTable] = useDeleteLttpPriceTableMutation();
  const [importPrice] = useImportLttpPriceTableMutation();
  const [createFoodGroup] = useCreateLttpFoodGroupMutation();
  const [patchFoodGroup] = usePatchLttpFoodGroupMutation();
  const [deleteFoodGroup] = useDeleteLttpFoodGroupMutation();
  const [createSupplier] = useCreateLttpSupplierMutation();
  const [patchSupplier] = usePatchLttpSupplierMutation();
  const [deleteSupplier] = useDeleteLttpSupplierMutation();
  const [putLttpCommodityDefault] = usePutLttpCommodityDefaultSupplierMutation();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDvt, setNewDvt] = useState("kg");
  /** "" = nhóm Khác (mặc định) */
  const [newGroupId, setNewGroupId] = useState("");
  const [newConv, setNewConv] = useState("");

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDvt, setEditDvt] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [editConv, setEditConv] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [fgCode, setFgCode] = useState("");
  const [fgName, setFgName] = useState("");

  const [newSupName, setNewSupName] = useState("");
  const [newSupRep, setNewSupRep] = useState("");
  const [newSupAddr, setNewSupAddr] = useState("");
  const [newSupGpkd, setNewSupGpkd] = useState("");
  const [newSupTax, setNewSupTax] = useState("");

  const [supEditId, setSupEditId] = useState(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupRep, setEditSupRep] = useState("");
  const [editSupAddr, setEditSupAddr] = useState("");
  const [editSupGpkd, setEditSupGpkd] = useState("");
  const [editSupTax, setEditSupTax] = useState("");

  const editingSupplier = useMemo(
    () => suppliers.find((s) => s.id === supEditId) ?? null,
    [suppliers, supEditId],
  );

  const newGroupCode = useMemo(() => {
    if (!newGroupId) {
      return OTHER_CODE;
    }
    const g = foodGroups.find((x) => x.id === Number(newGroupId));
    return g?.code ?? OTHER_CODE;
  }, [foodGroups, newGroupId]);

  const editGroupCode = useMemo(() => {
    if (!editGroupId) {
      return OTHER_CODE;
    }
    const g = foodGroups.find((x) => x.id === Number(editGroupId));
    return g?.code ?? OTHER_CODE;
  }, [foodGroups, editGroupId]);

  const editingCommodity = useMemo(
    () => commodities.find((c) => c.id === editId) ?? null,
    [commodities, editId],
  );

  /** Giá đang hiệu lực tại `effectiveDate` — dùng cột «hiện tại» ở tab Cập nhật bảng giá. */
  const effectivePriceByCommodityId = useMemo(() => {
    const items = effectiveData?.items || [];
    const m = new Map();
    for (const row of items) {
      m.set(row.commodity.id, { unitPrice: row.unitPrice, tgsxPrice: row.tgsxPrice });
    }
    return m;
  }, [effectiveData?.items]);

  useEffect(() => {
    if (!editId || !canCWrite) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setEditId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId, canCWrite]);

  useEffect(() => {
    if (!supEditId || !canCWrite) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setSupEditId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supEditId, canCWrite]);

  useEffect(() => {
    if (newGroupCode === OTHER_CODE) {
      setNewConv("");
    }
  }, [newGroupCode]);

  useEffect(() => {
    if (editGroupCode === OTHER_CODE) {
      setEditConv("");
    }
  }, [editGroupCode]);

  const [ptDate, setPtDate] = useState(() => localYmd());
  const [ptNote, setPtNote] = useState("");
  const [ptRows, setPtRows] = useState([]);
  /** Tránh reset toàn bộ lưới giá khi RTK refetch `commodities` (mất focus / xóa đang gõ). */
  const priceGridUnitRef = useRef(null);
  const priceGridPrevPtDateRef = useRef(null);
  /** Giá hiệu lực tại ngày áp dụng bảng — mặc định cột «mới». */
  const { data: applyDateEffectiveData, isLoading: applyDatePriceLoad } = useGetLttpEffectivePricesQuery(
    { unitId: selectedUnitId, date: ptDate },
    { skip: !selectedUnitId || !canPRead },
  );
  const applyDatePriceByCommodityId = useMemo(() => {
    const items = applyDateEffectiveData?.items || [];
    const m = new Map();
    for (const row of items) {
      m.set(row.commodity.id, { unitPrice: row.unitPrice, tgsxPrice: row.tgsxPrice });
    }
    return m;
  }, [applyDateEffectiveData?.items]);

  const [impFile, setImpFile] = useState(null);
  const [impDate, setImpDate] = useState(() => localYmd());
  const [impNote, setImpNote] = useState("");
  const [impTplLoading, setImpTplLoading] = useState(false);

  useEffect(() => {
    if (!commodities.length) {
      setPtRows([]);
      priceGridUnitRef.current = null;
      priceGridPrevPtDateRef.current = null;
      return;
    }
    const uid = selectedUnitId;
    const prevUid = priceGridUnitRef.current;
    const unitSwitched = prevUid != null && prevUid !== uid;
    const prevPt = priceGridPrevPtDateRef.current;
    const ptDateChanged = prevPt != null && prevPt !== ptDate;
    priceGridUnitRef.current = uid;
    priceGridPrevPtDateRef.current = ptDate;

    setPtRows((prev) => {
      const prevById = new Map(prev.map((r) => [r.commodityId, r]));
      return commodities
        .filter((c) => c.isActive)
        .map((c) => {
          const hit = applyDatePriceByCommodityId.get(c.id);
          const hasApplyRef = hit?.unitPrice != null && Number.isFinite(Number(hit.unitPrice));
          const upFromRef = hasApplyRef ? Number(hit.unitPrice) : 0;
          const tgsxFromRef =
            hit?.tgsxPrice != null && Number.isFinite(Number(hit.tgsxPrice)) ? Number(hit.tgsxPrice) : null;

          if (unitSwitched || ptDateChanged) {
            return {
              commodityId: c.id,
              code: c.code,
              name: c.name,
              unitPrice: upFromRef,
              tgsxPrice: tgsxFromRef,
            };
          }

          const old = prevById.get(c.id);
          if (old) {
            if (isPtRowNewPricesBlank(old) && hasApplyRef) {
              return {
                commodityId: c.id,
                code: c.code,
                name: c.name,
                unitPrice: upFromRef,
                tgsxPrice: tgsxFromRef,
              };
            }
            return {
              commodityId: c.id,
              code: c.code,
              name: c.name,
              unitPrice: old.unitPrice,
              tgsxPrice: old.tgsxPrice,
            };
          }

          return {
            commodityId: c.id,
            code: c.code,
            name: c.name,
            unitPrice: upFromRef,
            tgsxPrice: tgsxFromRef,
          };
        });
    });
  }, [commodities, selectedUnitId, ptDate, applyDatePriceByCommodityId]);

  function openEdit(c) {
    setEditId(c.id);
    setEditName(c.name);
    setEditDvt(c.measureUnit);
    setEditGroupId(c.group?.id != null ? String(c.group.id) : "");
    setEditConv(
      c.group?.code === OTHER_CODE ? "" : c.conversionRate != null ? String(c.conversionRate) : "",
    );
    setEditActive(c.isActive);
  }

  async function onAddCommodity(e) {
    e.preventDefault();
    if (!selectedUnitId || !newCode.trim() || !newName.trim()) {
      notifyError("Chọn đơn vị và nhập mã, tên.");
      return;
    }
    if (newGroupCode !== OTHER_CODE && (newConv === "" || Number(newConv) <= 0)) {
      notifyError("Nhóm này cần tỷ lệ quy đổi (số dương).");
      return;
    }
    try {
      await createCommodity({
        unitId: selectedUnitId,
        code: newCode.trim(),
        name: newName.trim(),
        measureUnit: newDvt.trim() || "kg",
        groupId: newGroupId === "" ? undefined : Number(newGroupId),
        conversionRate:
          newGroupCode === OTHER_CODE ? undefined : newConv === "" ? undefined : Number(newConv),
        isActive: true,
      }).unwrap();
      notifySuccess("Đã thêm mặt hàng.");
      setNewCode("");
      setNewName("");
      setNewGroupId("");
      setNewConv("");
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được.");
    }
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editId || !selectedUnitId) return;
    if (editGroupCode !== OTHER_CODE && (editConv === "" || Number(editConv) <= 0)) {
      notifyError("Nhóm này cần tỷ lệ quy đổi (số dương).");
      return;
    }
    try {
      await patchCommodity({
        id: editId,
        unitId: selectedUnitId,
        body: {
          name: editName.trim(),
          measureUnit: editDvt.trim(),
          groupId: editGroupId === "" ? null : Number(editGroupId),
          conversionRate:
            editGroupCode === OTHER_CODE ? null : editConv === "" ? null : Number(editConv),
          isActive: editActive,
        },
      }).unwrap();
      notifySuccess("Đã cập nhật.");
      setEditId(null);
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được.");
    }
  }

  async function onDeleteCommodity(c) {
    const ok = await confirm({
      title: "Xóa mặt hàng",
      message: `Xóa «${c.name}» (${c.code})? Chỉ thực hiện được khi chưa dùng trong bảng giá.`,
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteCommodity({ id: c.id, unitId: selectedUnitId }).unwrap();
      notifySuccess("Đã xóa.");
    } catch (err) {
      notifyError(err?.data?.message || "Không xóa được.");
    }
  }

  function toOptNull(s) {
    const t = String(s ?? "").trim();
    return t ? t : null;
  }

  function openSupEdit(s) {
    setSupEditId(s.id);
    setEditSupName(s.name);
    setEditSupRep(s.representativeName);
    setEditSupAddr(s.address ?? "");
    setEditSupGpkd(s.businessLicenseNo ?? "");
    setEditSupTax(s.taxCode ?? "");
  }

  async function onAddSupplier(e) {
    e.preventDefault();
    if (!selectedUnitId || !newSupName.trim() || !newSupRep.trim()) {
      notifyError("Nhập tên đối tác và tên người đại diện.");
      return;
    }
    try {
      await createSupplier({
        unitId: selectedUnitId,
        name: newSupName.trim(),
        representativeName: newSupRep.trim(),
        address: toOptNull(newSupAddr),
        businessLicenseNo: toOptNull(newSupGpkd),
        taxCode: toOptNull(newSupTax),
      }).unwrap();
      notifySuccess("Đã thêm đối tác.");
      setNewSupName("");
      setNewSupRep("");
      setNewSupAddr("");
      setNewSupGpkd("");
      setNewSupTax("");
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được.");
    }
  }

  async function onSaveSupEdit(e) {
    e.preventDefault();
    if (!supEditId || !selectedUnitId) return;
    if (!editSupName.trim() || !editSupRep.trim()) {
      notifyError("Tên đối tác và tên người đại diện không được để trống.");
      return;
    }
    try {
      await patchSupplier({
        id: supEditId,
        body: {
          name: editSupName.trim(),
          representativeName: editSupRep.trim(),
          address: toOptNull(editSupAddr),
          businessLicenseNo: toOptNull(editSupGpkd),
          taxCode: toOptNull(editSupTax),
        },
      }).unwrap();
      notifySuccess("Đã cập nhật đối tác.");
      setSupEditId(null);
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được.");
    }
  }

  async function onDeleteSupplier(s) {
    const ok = await confirm({
      title: "Xóa đối tác cung cấp",
      message: `Xóa «${s.name}»?`,
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteSupplier({ id: s.id }).unwrap();
      notifySuccess("Đã xóa.");
    } catch (err) {
      notifyError(err?.data?.message || "Không xóa được.");
    }
  }

  async function onAddFoodGroup(ev) {
    ev.preventDefault();
    if (!fgCode.trim() || !fgName.trim()) {
      notifyError("Nhập mã và tên nhóm.");
      return;
    }
    try {
      await createFoodGroup({
        code: fgCode.trim(),
        name: fgName.trim(),
        isActive: true,
      }).unwrap();
      notifySuccess("Đã tạo nhóm.");
      setFgCode("");
      setFgName("");
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được nhóm.");
    }
  }

  async function onToggleFoodGroupActive(g) {
    try {
      await patchFoodGroup({ id: g.id, body: { isActive: !g.isActive } }).unwrap();
      notifySuccess("Đã cập nhật trạng thái nhóm.");
    } catch (err) {
      notifyError(err?.data?.message || "Không cập nhật được.");
    }
  }

  async function onRemoveFoodGroup(g) {
    if (g.code === OTHER_CODE) return;
    const ok = await confirm({
      title: "Xóa nhóm",
      message: `Xóa nhóm «${g.name}» (${g.code})? Chỉ được phép khi không còn mặt hàng gắn nhóm.`,
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteFoodGroup(g.id).unwrap();
      notifySuccess("Đã xóa nhóm.");
    } catch (err) {
      notifyError(err?.data?.message || "Không xóa được.");
    }
  }

  function fillNewPricesFromApplyDate() {
    setPtRows((prev) =>
      prev.map((r) => {
        const hit = applyDatePriceByCommodityId.get(r.commodityId);
        const has = hit?.unitPrice != null && Number.isFinite(Number(hit.unitPrice));
        return {
          ...r,
          unitPrice: has ? Number(hit.unitPrice) : 0,
          tgsxPrice:
            hit?.tgsxPrice != null && Number.isFinite(Number(hit.tgsxPrice)) ? Number(hit.tgsxPrice) : null,
        };
      }),
    );
    notifySuccess(`Đã điền cột «mới» theo giá hiệu lực tại ngày áp dụng (${ptDate}).`);
  }

  function fillNewPricesFromReferenceDate() {
    setPtRows((prev) =>
      prev.map((r) => {
        const hit = effectivePriceByCommodityId.get(r.commodityId);
        return {
          ...r,
          unitPrice: hit?.unitPrice != null ? Number(hit.unitPrice) : r.unitPrice,
          tgsxPrice: hit?.tgsxPrice != null ? Number(hit.tgsxPrice) : r.tgsxPrice,
        };
      }),
    );
    notifySuccess(`Đã điền cột «mới» theo cột «hiện tại» (ngày tham chiếu ${effectiveDate}).`);
  }

  async function onSavePriceTable(e) {
    e.preventDefault();
    if (!selectedUnitId || !ptRows.length) {
      notifyError("Không có dòng giá.");
      return;
    }
    const rows = ptRows
      .map((r) => ({
        commodityId: r.commodityId,
        unitPrice: Number(r.unitPrice),
        tgsxPrice:
          r.tgsxPrice === "" || r.tgsxPrice == null || Number.isNaN(Number(r.tgsxPrice))
            ? null
            : Number(r.tgsxPrice),
      }))
      .filter((r) => Number.isFinite(r.unitPrice) && r.unitPrice >= 0);
    if (!rows.length) {
      notifyError("Cần ít nhất một dòng có đơn giá.");
      return;
    }
    try {
      await createPriceTable({
        unitId: selectedUnitId,
        effectiveDate: ptDate,
        note: ptNote.trim() || null,
        rows,
      }).unwrap();
      notifySuccess("Đã lưu bảng giá cho ngày áp dụng.");
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được.");
    }
  }

  async function onDeleteTable(t) {
    const ok = await confirm({
      title: "Xóa phiên bản bảng giá",
      message: `Xóa bảng giá ngày ${t.effectiveDate}?`,
      confirmLabel: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deletePriceTable({ id: t.id, unitId: selectedUnitId }).unwrap();
      notifySuccess("Đã xóa.");
    } catch (err) {
      notifyError(err?.data?.message || "Không xóa được.");
    }
  }

  async function onImport(e) {
    e.preventDefault();
    if (!selectedUnitId || !impFile) {
      notifyError("Chọn file Excel.");
      return;
    }
    try {
      await importPrice({
        file: impFile,
        unitId: selectedUnitId,
        effectiveDate: impDate,
        note: impNote.trim() || null,
      }).unwrap();
      notifySuccess("Đã nhập bảng giá từ Excel.");
      setImpFile(null);
    } catch (err) {
      notifyError(err?.data?.message || "Nhập không thành công.");
    }
  }

  async function downloadImportTemplate() {
    if (!selectedUnitId) {
      notifyError("Chọn đơn vị.");
      return;
    }
    setImpTplLoading(true);
    try {
      const res = await httpClient.get("/lttp/price-tables/import-template", {
        params: { unitId: selectedUnitId, date: impDate },
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lttp-mau-banggia-u${selectedUnitId}-${impDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Đã tải file mẫu.");
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.message || "Không tải được mẫu.");
    } finally {
      setImpTplLoading(false);
    }
  }

  const subTabs = useMemo(
    () =>
      [
        { id: "food-groups", label: "Nhóm LTTP", show: canManageLttpGroups },
        { id: "commodities", label: "Mặt hàng", show: canCRead && !groupsOnly },
        { id: "suppliers", label: "Đối tác cung cấp", show: canCRead && !groupsOnly },
        { id: "tables", label: "Lịch sử bảng giá", show: canPRead && !groupsOnly },
        { id: "effective", label: "Giá theo ngày", show: canPRead && !groupsOnly },
        { id: "newtable", label: "Cập nhật bảng giá", show: canPRead && canPWrite && !groupsOnly },
        { id: "import", label: "Nhập Excel", show: canPRead && canPWrite && !groupsOnly },
      ].filter((x) => x.show),
    [canManageLttpGroups, canCRead, canPRead, canPWrite, groupsOnly],
  );

  useEffect(() => {
    if (subTabs.length && !subTabs.some((t) => t.id === sub)) {
      setSub(subTabs[0].id, { replace: true });
    }
  }, [subTabs, sub, setSub]);

  if (groupsOnly && !canManageLttpGroups) {
    return (
      <p className="text-xs text-muted-foreground">
        Cần quyền <span className="font-mono text-[10px]">lttp.groups.manage</span> để quản lý nhóm LTTP toàn cục.
      </p>
    );
  }

  if (!groupsOnly && !canCRead && !canPRead) {
    return (
      <p className="text-xs text-muted-foreground">
        Bạn không có quyền xem bảng giá lương thực thực phẩm. Liên hệ quản trị để được gán quyền lttp.*
      </p>
    );
  }

  return (
    <Card className="shadow-soft w-full min-w-0">
      <CardContent className="flex flex-col gap-3 !p-3 sm:!p-4">
        {!groupsOnly ? (
          <p className="text-xs text-muted-foreground">
            Đơn vị LTTP:{" "}
            {selectedUnitLabel ? (
              <span className="font-medium text-foreground">{selectedUnitLabel}</span>
            ) : (
              <span className="text-destructive">chưa xác định</span>
            )}
            {canPickAnyUnit ? (
              <span className="block text-[10px] text-muted-foreground sm:inline sm:pl-1">
                (chọn đơn vị trên thanh «Đơn vị đang xem» nếu cần)
              </span>
            ) : null}
          </p>
        ) : null}

        {!groupsOnly && !selectedUnitId ? (
          <p className="text-xs text-destructive">Chưa có đơn vị làm việc — gán đơn vị cho tài khoản hoặc chọn đơn vị.</p>
        ) : (
          <>
            {subTabs.length > 1 ? (
              <ScrollableHorizontalStrip
                role="tablist"
                aria-label="Mục bảng giá LTTP"
                className="shrink-0 border-b border-border/70 bg-background/80 pb-px"
                innerClassName="flex flex-nowrap gap-0.5"
              >
                {subTabs.map((t) => {
                  const tabBase =
                    "relative shrink-0 whitespace-nowrap rounded-t-md px-2.5 py-2.5 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-9 sm:text-sm sm:px-3";
                  const tabOn =
                    "text-foreground after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary";
                  const tabOff = "text-muted-foreground hover:text-foreground";

                  if (isRouteDriven && !groupsOnly) {
                    const routeKey = DASHBOARD_LTTP_SUB_ACCESS_KEY[t.id];
                    return (
                      <GuardedNavLink
                        key={t.id}
                        role="tab"
                        routeAccessKey={routeKey}
                        href={`/dashboard/lttp/${t.id}`}
                        end
                        className={({ isActive }) => cn(tabBase, isActive ? tabOn : tabOff)}
                      >
                        {t.label}
                      </GuardedNavLink>
                    );
                  }

                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={sub === t.id}
                      className={cn(tabBase, sub === t.id ? tabOn : tabOff)}
                      onClick={() => setSub(t.id, {})}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </ScrollableHorizontalStrip>
            ) : null}

            <div className="pr-1">
              {sub === "food-groups" && canManageLttpGroups ? (
                <div className="space-y-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Nhóm dùng chung toàn hệ thống. Mã nhóm là khóa kỹ thuật (vd. <span className="font-mono">gao</span>) — admin
                    chọn khi khai báo mặt hàng. Nhóm <span className="font-medium">Khác</span> không cần tỷ lệ quy đổi.
                  </p>
                  <form
                    onSubmit={onAddFoodGroup}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-card/50 p-2"
                  >
                    <label className="w-28" htmlFor="ql-lttp-fg-code">
                      <span className="text-[10px] text-muted-foreground">Mã nhóm</span>
                      <input
                        id="ql-lttp-fg-code"
                        name="lttpFoodGroupCode"
                        className={inputClass}
                        value={fgCode}
                        onChange={(e) => setFgCode(e.target.value)}
                        placeholder="gao"
                      />
                    </label>
                    <label className="min-w-[10rem] flex-1" htmlFor="ql-lttp-fg-name">
                      <span className="text-[10px] text-muted-foreground">Tên hiển thị</span>
                      <input
                        id="ql-lttp-fg-name"
                        name="lttpFoodGroupName"
                        className={inputClass}
                        value={fgName}
                        onChange={(e) => setFgName(e.target.value)}
                      />
                    </label>
                    <Button type="submit" className="h-8 gap-1 text-xs">
                      <Plus className="size-3.5" aria-hidden />
                      Thêm nhóm
                    </Button>
                  </form>
                  {fgCatLoad ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
                  <ResponsiveTableWrap className="border-border/60">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-1.5">Mã</th>
                          <th className="px-2 py-1.5">Tên</th>
                          <th className="px-2 py-1.5">Hiệu lực</th>
                          <th className="px-2 py-1.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodGroupsCatalog.map((g) => (
                          <tr key={g.id} className="border-b border-border/50">
                            <td className="px-2 py-1 font-mono text-[10px]">{g.code}</td>
                            <td className="px-2 py-1">{g.name}</td>
                            <td className="px-2 py-1">{g.isActive ? "Đang dùng" : "Ngưng"}</td>
                            <td className="px-2 py-1 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => onToggleFoodGroupActive(g)}
                                  disabled={g.code === OTHER_CODE && g.isActive}
                                >
                                  {g.isActive ? "Ngưng" : "Bật"}
                                </Button>
                                {g.code !== OTHER_CODE ? (
                                  <IconButton label="Xóa nhóm" variant="danger" onClick={() => onRemoveFoodGroup(g)}>
                                    <Trash2 aria-hidden />
                                  </IconButton>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                </div>
              ) : null}

              {sub === "commodities" && canCRead ? (
                <div className="space-y-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Áp mặt hàng xuống <span className="font-medium text-foreground">nhiều</span> đơn vị cấp dưới (dùng chung
                    nguồn với đơn vị cha): tab{" "}
                    <span className="font-medium text-foreground">Đồng bộ đơn vị con</span> trên bảng điều khiển. Đối tác
                    mặc định (phiếu xuất) cấu hình từng dòng; chọn xong lưu ngay.
                  </p>
                  {canCWrite ? (
                    <form
                      onSubmit={onAddCommodity}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-card/50 p-2"
                    >
                      <label className="min-w-[8ch]">
                        <span className="text-[10px] text-muted-foreground">Mã</span>
                        <input className={inputClass} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                      </label>
                      <label className="min-w-[10rem] flex-1">
                        <span className="text-[10px] text-muted-foreground">Tên</span>
                        <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} />
                      </label>
                      <label className="w-20">
                        <span className="text-[10px] text-muted-foreground">ĐVT</span>
                        <input className={inputClass} value={newDvt} onChange={(e) => setNewDvt(e.target.value)} />
                      </label>
                      <label className="min-w-[9rem]">
                        <span className="text-[10px] text-muted-foreground">Nhóm LTTP</span>
                        <select
                          className={cn(inputClass, "py-1.5")}
                          value={newGroupId}
                          onChange={(e) => setNewGroupId(e.target.value)}
                          disabled={!canGRead}
                        >
                          <option value="">Khác (mặc định)</option>
                          {foodGroups.map((g) => (
                            <option key={g.id} value={String(g.id)}>
                              {g.name} ({g.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="w-28">
                        <span className="text-[10px] text-muted-foreground">Tỉ lệ QĐ</span>
                        <input
                          className={cn(inputClass, newGroupCode === OTHER_CODE && "opacity-50")}
                          value={newConv}
                          onChange={(e) => setNewConv(e.target.value)}
                          disabled={newGroupCode === OTHER_CODE}
                          placeholder={newGroupCode === OTHER_CODE ? "—" : "bắt buộc"}
                        />
                      </label>
                      <Button type="submit" className="h-8 gap-1 text-xs">
                        <Plus className="size-3.5" aria-hidden />
                        Thêm
                      </Button>
                    </form>
                  ) : null}
                  {cLoad ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
                  <ResponsiveTableWrap className="border-border/60">
                    <table className="w-full min-w-[880px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-1.5">Mã</th>
                          <th className="px-2 py-1.5">Tên</th>
                          <th className="px-2 py-1.5">ĐVT</th>
                          <th className="px-2 py-1.5">Nhóm</th>
                          <th className="px-2 py-1.5">Tỉ lệ QĐ</th>
                          <th className="px-2 py-1.5">Đối tác mặc định</th>
                          <th className="px-2 py-1.5">HT</th>
                          <th className="px-2 py-1.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commodities.map((c) => (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="px-2 py-1 font-mono text-[10px]">{c.code}</td>
                            <td className="px-2 py-1">{c.name}</td>
                            <td className="px-2 py-1">{c.measureUnit}</td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {c.group?.name ?? "—"}
                              {c.group?.code ? (
                                <span className="ml-1 font-mono text-[10px]">({c.group.code})</span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1 tabular-nums">{c.conversionRate ?? "—"}</td>
                            <td className="min-w-[10rem] px-1 py-1">
                              {canCWrite ? (
                                <select
                                  className={cn(inputClass, "py-1.5 text-[10px]")}
                                  value={c.defaultLttpSupplier?.id != null ? String(c.defaultLttpSupplier.id) : ""}
                                  onChange={async (e) => {
                                    const v = e.target.value;
                                    try {
                                      await putLttpCommodityDefault({
                                        id: c.id,
                                        lttpSupplierId: v === "" ? null : Number(v),
                                      }).unwrap();
                                      notifySuccess("Đã cập nhật đối tác mặc định cho mặt hàng.");
                                    } catch (err) {
                                      notifyError(err?.data?.message || "Không lưu được.");
                                    }
                                  }}
                                >
                                  <option value="">—</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={String(s.id)}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[10px] text-muted-foreground" title={c.defaultLttpSupplier?.name ?? ""}>
                                  {c.defaultLttpSupplier?.name ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1">{c.isActive ? "✓" : "—"}</td>
                            <td className="px-2 py-1 text-right">
                              {canCWrite ? (
                                <div className="flex justify-end gap-1">
                                  <IconButton label="Sửa" variant="surface" onClick={() => openEdit(c)}>
                                    <Pencil aria-hidden />
                                  </IconButton>
                                  <IconButton label="Xóa" variant="danger" onClick={() => onDeleteCommodity(c)}>
                                    <Trash2 aria-hidden />
                                  </IconButton>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                </div>
              ) : null}

              {sub === "suppliers" && canCRead ? (
                <div className="space-y-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Danh sách đối tác cung cấp theo <span className="font-medium text-foreground">đơn vị đang chọn</span> — mỗi
                    đơn vị quản lý riêng.
                  </p>
                  {canCWrite ? (
                    <form
                      onSubmit={onAddSupplier}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-card/50 p-2"
                    >
                      <label className="min-w-[9rem] flex-1">
                        <span className="text-[10px] text-muted-foreground">Tên đối tác *</span>
                        <input
                          className={inputClass}
                          value={newSupName}
                          onChange={(e) => setNewSupName(e.target.value)}
                          autoComplete="organization"
                        />
                      </label>
                      <label className="min-w-[9rem] flex-1">
                        <span className="text-[10px] text-muted-foreground">Người đại diện *</span>
                        <input
                          className={inputClass}
                          value={newSupRep}
                          onChange={(e) => setNewSupRep(e.target.value)}
                          autoComplete="name"
                        />
                      </label>
                      <label className="min-w-[10rem] flex-[1.2]">
                        <span className="text-[10px] text-muted-foreground">Địa chỉ</span>
                        <input
                          className={inputClass}
                          value={newSupAddr}
                          onChange={(e) => setNewSupAddr(e.target.value)}
                        />
                      </label>
                      <label className="w-28 sm:w-32">
                        <span className="text-[10px] text-muted-foreground">Số GPKD</span>
                        <input
                          className={inputClass}
                          value={newSupGpkd}
                          onChange={(e) => setNewSupGpkd(e.target.value)}
                        />
                      </label>
                      <label className="w-28 sm:w-32">
                        <span className="text-[10px] text-muted-foreground">Mã số thuế</span>
                        <input
                          className={inputClass}
                          value={newSupTax}
                          onChange={(e) => setNewSupTax(e.target.value)}
                        />
                      </label>
                      <Button type="submit" className="h-8 gap-1 text-xs">
                        <Plus className="size-3.5" aria-hidden />
                        Thêm
                      </Button>
                    </form>
                  ) : null}
                  {supLoad ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
                  <ResponsiveTableWrap className="border-border/60">
                    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-1.5">ID</th>
                          <th className="px-2 py-1.5">Tên đối tác</th>
                          <th className="px-2 py-1.5">Người đại diện</th>
                          <th className="px-2 py-1.5">Địa chỉ</th>
                          <th className="px-2 py-1.5">GPKD</th>
                          <th className="px-2 py-1.5">MST</th>
                          <th className="px-2 py-1.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.id} className="border-b border-border/50">
                            <td className="px-2 py-1 font-mono text-[10px] tabular-nums">{s.id}</td>
                            <td className="px-2 py-1">{s.name}</td>
                            <td className="px-2 py-1">{s.representativeName}</td>
                            <td className="px-2 py-1 text-muted-foreground">{s.address || "—"}</td>
                            <td className="px-2 py-1 text-muted-foreground">{s.businessLicenseNo || "—"}</td>
                            <td className="px-2 py-1 text-muted-foreground">{s.taxCode || "—"}</td>
                            <td className="px-2 py-1 text-right">
                              {canCWrite ? (
                                <div className="flex justify-end gap-1">
                                  <IconButton label="Sửa" variant="surface" onClick={() => openSupEdit(s)}>
                                    <Pencil aria-hidden />
                                  </IconButton>
                                  <IconButton label="Xóa" variant="danger" onClick={() => onDeleteSupplier(s)}>
                                    <Trash2 aria-hidden />
                                  </IconButton>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                  {!suppliers.length && !supLoad ? (
                    <p className="text-xs text-muted-foreground">Chưa có đối tác nào.</p>
                  ) : null}
                </div>
              ) : null}

              {sub === "tables" && canPRead ? (
                <div className="space-y-2">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Áp bảng giá xuống nhiều đơn vị con — tab{" "}
                    <span className="font-medium text-foreground">Đồng bộ đơn vị con</span>.
                  </p>
                  {tLoad ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
                  <ul className="space-y-1.5">
                    {priceTables.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <Table2 className="size-3.5 text-muted-foreground" aria-hidden />
                          <span className="font-medium">Áp dụng từ {t.effectiveDate}</span>
                          <span className="text-muted-foreground">{t.rowCount} dòng</span>
                        </span>
                        {canPWrite ? (
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <IconButton label="Xóa phiên bản" variant="danger" onClick={() => onDeleteTable(t)}>
                              <Trash2 aria-hidden />
                            </IconButton>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {!priceTables.length && !tLoad ? (
                    <p className="text-xs text-muted-foreground">Chưa có phiên bản bảng giá.</p>
                  ) : null}
                </div>
              ) : null}

              {sub === "effective" && canPRead ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <span className="shrink-0 text-muted-foreground">Ngày tra cứu</span>
                      <input
                        type="date"
                        className={cn(inputClass, "w-auto min-w-[10.5rem]")}
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                      />
                    </label>
                    {eLoad ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Áp dụng bảng giá ngày{" "}
                    <span className="font-medium text-foreground">{effectiveData?.appliedEffectiveDate ?? "—"}</span>
                    {effectiveData?.note ? ` — ${effectiveData.note}` : ""}
                  </p>
                  <ResponsiveTableWrap className="border-border/60">
                    <table className="w-full min-w-[36rem] table-fixed border-collapse text-xs">
                      <colgroup>
                        <col className="w-[9%]" />
                        <col className="w-[46%]" />
                        <col className="w-[22.5%]" />
                        <col className="w-[22.5%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-[1] bg-secondary/95 shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur-sm">
                        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="border-b border-border px-3 py-2.5 text-left font-semibold">Mã</th>
                          <th className="border-b border-border px-3 py-2.5 text-left font-semibold">Tên</th>
                          <th className="border-b border-border px-3 py-2.5 text-right font-semibold">Đơn giá (VNĐ)</th>
                          <th className="border-b border-border px-3 py-2.5 text-right font-semibold">Giá TGSX (VNĐ)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(effectiveData?.items || []).length ? (
                          (effectiveData?.items || []).map((row) => (
                            <tr key={row.commodity.id} className="bg-background transition-colors hover:bg-muted/30">
                              <td className="px-3 py-2 align-middle font-mono text-[10px] leading-snug text-foreground">
                                {row.commodity.code}
                              </td>
                              <td className="min-w-0 px-3 py-2 align-middle leading-snug text-foreground">
                                <span className="line-clamp-2">{row.commodity.name}</span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-middle text-right tabular-nums text-foreground">
                                {formatVnd(row.unitPrice)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 align-middle text-right tabular-nums text-foreground">
                                {formatVnd(row.tgsxPrice)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-8 text-center text-[11px] text-muted-foreground"
                            >
                              {eLoad
                                ? "Đang tải…"
                                : "Không có mặt hàng hoặc chưa có giá cho ngày đã chọn."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                </div>
              ) : null}

              {sub === "newtable" && canPWrite ? (
                <form onSubmit={onSavePriceTable} className="space-y-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Mỗi lần lưu tạo hoặc ghi đè bảng giá cho <span className="font-medium text-foreground">một ngày áp dụng</span>.
                    Ngày không cập nhật vẫn dùng bản gần nhất trước đó.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs">
                      Ngày áp dụng
                      <input type="date" className={cn(inputClass, "mt-0.5 block")} value={ptDate} onChange={(e) => setPtDate(e.target.value)} />
                    </label>
                    <label className="text-xs">
                      Ngày tham chiếu (giá hiện tại)
                      <input
                        type="date"
                        className={cn(inputClass, "mt-0.5 block")}
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                      />
                    </label>
                    <label className="min-w-[12rem] flex-1 text-xs">
                      Ghi chú
                      <input className={cn(inputClass, "mt-0.5 block")} value={ptNote} onChange={(e) => setPtNote(e.target.value)} />
                    </label>
                    <Button type="button" variant="secondary" className="h-8 gap-1 text-xs" onClick={fillNewPricesFromApplyDate}>
                      <RefreshCw className="size-3.5" aria-hidden />
                      Lấy theo ngày áp dụng ({ptDate})
                    </Button>
                    <Button type="button" variant="ghost" className="h-8 gap-1 text-xs" onClick={fillNewPricesFromReferenceDate}>
                      Theo ngày tham chiếu ({effectiveDate})
                    </Button>
                    {applyDatePriceLoad ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : null}
                  </div>
                  <ResponsiveTableWrap className="border-border/60">
                    <table className="w-full min-w-[56rem] border-collapse text-left text-[11px]">
                      <thead className="sticky top-0 bg-secondary/90">
                        <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                          <th className="px-2 py-1.5">Mã</th>
                          <th className="px-2 py-1.5">Tên</th>
                          <th className="px-2 py-1.5 text-right">Đơn giá hiện tại</th>
                          <th className="px-2 py-1.5 text-right">TGSX hiện tại</th>
                          <th className="px-2 py-1.5">Đơn giá mới (VNĐ)</th>
                          <th className="px-2 py-1.5">TGSX mới (VNĐ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ptRows.map((r, i) => {
                          const cur = effectivePriceByCommodityId.get(r.commodityId);
                          return (
                          <tr key={r.commodityId} className="border-b border-border/50">
                            <td className="px-2 py-1 font-mono text-[10px]">{r.code}</td>
                            <td className="px-2 py-1">{r.name}</td>
                            <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-muted-foreground">
                              {cur != null && cur.unitPrice != null ? formatVnd(cur.unitPrice) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-muted-foreground">
                              {cur != null && cur.tgsxPrice != null ? formatVnd(cur.tgsxPrice) : "—"}
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                className={cn(inputClass, noSpinnerNumClass, "min-w-[6rem] py-1")}
                                value={r.unitPrice}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPtRows((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], unitPrice: v === "" ? "" : Number(v) };
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                className={cn(inputClass, noSpinnerNumClass, "min-w-[6rem] py-1")}
                                value={r.tgsxPrice ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPtRows((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], tgsxPrice: v === "" ? null : Number(v) };
                                    return next;
                                  });
                                }}
                              />
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                  <Button type="submit" className="gap-1.5 text-xs">
                    <Save className="size-3.5" aria-hidden />
                    Lưu bảng giá
                  </Button>
                </form>
              ) : null}

              {sub === "import" && canPWrite ? (
                <form onSubmit={onImport} className="max-w-xl space-y-3 text-xs">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Một sheet «BangGia»: dòng 1 là tiêu đề; bắt buộc có cột <span className="font-medium">Mã</span> và{" "}
                    <span className="font-medium">Đơn giá</span>. Cột <span className="font-medium">Tên nhóm</span> có
                    danh sách chọn theo nhóm đang hiệu lực — điền đúng tên (hoặc để trống = nhóm Khác). Dòng có{" "}
                    <span className="font-medium">Mã</span> mới sẽ tự tạo mặt hàng.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[10rem] flex-1 space-y-0.5">
                      Ngày áp dụng (mẫu + nhập)
                      <input type="date" className={inputClass} value={impDate} onChange={(e) => setImpDate(e.target.value)} />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 gap-1.5 text-xs"
                      disabled={impTplLoading || !selectedUnitId}
                      onClick={() => downloadImportTemplate()}
                    >
                      {impTplLoading ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Download className="size-3.5" aria-hidden />
                      )}
                      Tải mẫu Excel
                    </Button>
                  </div>
                  <label className="block space-y-0.5">
                    Ghi chú
                    <input className={inputClass} value={impNote} onChange={(e) => setImpNote(e.target.value)} />
                  </label>
                  <label className="block space-y-0.5">
                    File .xlsx
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="mt-1 block w-full text-[11px]"
                      onChange={(e) => setImpFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Button type="submit" className="gap-1.5 text-xs">
                    <Upload className="size-3.5" aria-hidden />
                    Nhập
                  </Button>
                </form>
              ) : null}

              {editId && canCWrite && editingCommodity ? (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
                  role="presentation"
                >
                  <button
                    type="button"
                    className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
                    aria-label="Đóng"
                    onClick={() => setEditId(null)}
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="lttp-edit-commodity-title"
                    className="relative flex max-h-[min(92dvh,36rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
                  >
                    <div className="shrink-0 space-y-1 border-b border-border px-4 pb-3 pt-4 sm:px-5">
                      <p
                        id="lttp-edit-commodity-title"
                        className="text-[10px] font-semibold uppercase tracking-wide text-primary"
                      >
                        Sửa mặt hàng
                      </p>
                      <p className="font-mono text-sm font-medium text-foreground">{editingCommodity.code}</p>
                    </div>
                    <form
                      onSubmit={onSaveEdit}
                      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                          <span className="text-[10px] text-muted-foreground">Tên</span>
                          <input className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label>
                          <span className="text-[10px] text-muted-foreground">ĐVT</span>
                          <input className={inputClass} value={editDvt} onChange={(e) => setEditDvt(e.target.value)} />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="text-[10px] text-muted-foreground">Nhóm LTTP</span>
                          <select
                            className={cn(inputClass, "mt-0.5 block py-1.5")}
                            value={editGroupId}
                            onChange={(e) => setEditGroupId(e.target.value)}
                            disabled={!canGRead}
                          >
                            <option value="">Khác (mặc định)</option>
                            {foodGroups.map((g) => (
                              <option key={g.id} value={String(g.id)}>
                                {g.name} ({g.code})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="sm:col-span-2 sm:max-w-[12rem]">
                          <span className="text-[10px] text-muted-foreground">Tỉ lệ QĐ</span>
                          <input
                            className={cn(inputClass, editGroupCode === OTHER_CODE && "opacity-50")}
                            value={editConv}
                            onChange={(e) => setEditConv(e.target.value)}
                            disabled={editGroupCode === OTHER_CODE}
                          />
                        </label>
                        <label className="flex items-center gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="rounded border-border"
                          />
                          <span className="text-xs">Đang dùng</span>
                        </label>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                        <Button type="submit" className="h-8 gap-1 text-xs">
                          <Save className="size-3.5" aria-hidden />
                          Lưu
                        </Button>
                        <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => setEditId(null)}>
                          Huỷ
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}

              {supEditId && canCWrite && editingSupplier ? (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
                  role="presentation"
                >
                  <button
                    type="button"
                    className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
                    aria-label="Đóng"
                    onClick={() => setSupEditId(null)}
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="lttp-edit-supplier-title"
                    className="relative flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
                  >
                    <div className="shrink-0 space-y-1 border-b border-border px-4 pb-3 pt-4 sm:px-5">
                      <p
                        id="lttp-edit-supplier-title"
                        className="text-[10px] font-semibold uppercase tracking-wide text-primary"
                      >
                        Sửa đối tác cung cấp
                      </p>
                      <p className="font-mono text-sm font-medium text-foreground">ID #{editingSupplier.id}</p>
                    </div>
                    <form
                      onSubmit={onSaveSupEdit}
                      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="sm:col-span-2">
                          <span className="text-[10px] text-muted-foreground">Tên đối tác *</span>
                          <input
                            className={inputClass}
                            value={editSupName}
                            onChange={(e) => setEditSupName(e.target.value)}
                            autoComplete="organization"
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="text-[10px] text-muted-foreground">Người đại diện *</span>
                          <input
                            className={inputClass}
                            value={editSupRep}
                            onChange={(e) => setEditSupRep(e.target.value)}
                            autoComplete="name"
                          />
                        </label>
                        <label className="sm:col-span-2">
                          <span className="text-[10px] text-muted-foreground">Địa chỉ</span>
                          <input className={inputClass} value={editSupAddr} onChange={(e) => setEditSupAddr(e.target.value)} />
                        </label>
                        <label>
                          <span className="text-[10px] text-muted-foreground">Số GPKD</span>
                          <input className={inputClass} value={editSupGpkd} onChange={(e) => setEditSupGpkd(e.target.value)} />
                        </label>
                        <label>
                          <span className="text-[10px] text-muted-foreground">Mã số thuế</span>
                          <input className={inputClass} value={editSupTax} onChange={(e) => setEditSupTax(e.target.value)} />
                        </label>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                        <Button type="submit" className="h-8 gap-1 text-xs">
                          <Save className="size-3.5" aria-hidden />
                          Lưu
                        </Button>
                        <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => setSupEditId(null)}>
                          Huỷ
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
}
