import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ResponsiveTableWrap } from "@/components/common/ScrollableHorizontalStrip";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { useApplyJobTitleToUnitMutation, useGetJobTitlesQuery } from "@/features/job-titles/api/jobTitlesApi";
import {
  useApplyLttpCommodityToUnitMutation,
  useApplyLttpPriceTableToUnitMutation,
  useGetLttpCommoditiesQuery,
  useGetLttpPriceTablesQuery,
} from "@/features/lttp/api/lttpApi";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import {
  useCreatePrivateDataShareMutation,
  useGetPrivateDataSharesQuery,
  useGetUnitsQuery,
  useRevokePrivateDataShareMutation,
} from "@/features/units/api/unitsApi";
import { listStrictDescendantUnits } from "@/features/unit-hierarchy/strictDescendantUnits";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FORK_SECTION_META = [
  { id: "jobTitles", label: "Chức danh" },
  { id: "commodities", label: "Mặt hàng LTTP" },
  { id: "priceTables", label: "Bảng giá LTTP" },
];

const DATA_KIND_OPTIONS = [
  { value: "LTTP_COMMODITY", label: "Mặt hàng LTTP", readPerm: PERMISSIONS.LTTP_COMMODITIES_READ },
  { value: "LTTP_PRICE_TABLE", label: "Bảng giá LTTP", readPerm: PERMISSIONS.LTTP_PRICES_READ },
  { value: "JOB_TITLE", label: "Chức danh", readPerm: PERMISSIONS.JOB_TITLES_READ },
];

function dataKindLabel(code) {
  return DATA_KIND_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function AdminUnitDataSharePanel() {
  const user = useCurrentUser();
  const { workingUnitId } = useTargetUnitScope();
  const canReadUnits = useHasPermission(PERMISSIONS.UNITS_READ);
  const canJtRead = useHasPermission(PERMISSIONS.JOB_TITLES_READ);
  const canJtApplyDown = useHasPermission(PERMISSIONS.JOB_TITLES_APPLY_DOWN);
  const canCRead = useHasPermission(PERMISSIONS.LTTP_COMMODITIES_READ);
  const canCApplyDown = useHasPermission(PERMISSIONS.LTTP_COMMODITIES_APPLY_DOWN);
  const canPRead = useHasPermission(PERMISSIONS.LTTP_PRICES_READ);
  const canPApplyDown = useHasPermission(PERMISSIONS.LTTP_PRICES_APPLY_DOWN);
  const canPrivateShare = useHasPermission(PERMISSIONS.UNITS_PRIVATE_DATA_SHARE_MANAGE);

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canReadUnits });
  const units = unitsData ?? [];
  const sortedUnits = useMemo(() => sortUnitsByPath(canReadUnits ? units : []), [canReadUnits, units]);

  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;
  const sourceUnitId = useMemo(() => {
    if (!canReadUnits) {
      return defaultUnitId;
    }
    if (workingUnitId != null) {
      return Number(workingUnitId);
    }
    if (sortedUnits.length) {
      return sortedUnits[0].id;
    }
    return defaultUnitId;
  }, [canReadUnits, workingUnitId, sortedUnits, defaultUnitId]);

  const sourceUnitLabel = useMemo(() => {
    if (sourceUnitId == null) {
      return null;
    }
    if (user?.unit?.id != null && Number(user.unit.id) === Number(sourceUnitId)) {
      return user.unit.name ?? `#${sourceUnitId}`;
    }
    return sortedUnits.find((u) => Number(u.id) === Number(sourceUnitId))?.name ?? `#${sourceUnitId}`;
  }, [sourceUnitId, user?.unit, sortedUnits]);

  const descendantUnits = useMemo(() => {
    if (sourceUnitId == null) {
      return [];
    }
    return sortUnitsByPath(listStrictDescendantUnits(sortedUnits, sourceUnitId));
  }, [sortedUnits, sourceUnitId]);

  const forkSections = useMemo(
    () =>
      FORK_SECTION_META.filter((s) => {
        if (s.id === "jobTitles") {
          return canJtRead && canJtApplyDown;
        }
        if (s.id === "commodities") {
          return canCRead && canCApplyDown;
        }
        if (s.id === "priceTables") {
          return canPRead && canPApplyDown;
        }
        return false;
      }),
    [canJtRead, canJtApplyDown, canCRead, canCApplyDown, canPRead, canPApplyDown],
  );

  const visibleSections = useMemo(() => {
    const out = [...forkSections];
    if (canPrivateShare) {
      out.push({ id: "privateGrants", label: "Chia sẻ quyền đọc private" });
    }
    return out;
  }, [forkSections, canPrivateShare]);

  const [section, setSection] = useState("jobTitles");

  useEffect(() => {
    if (visibleSections.length && !visibleSections.some((s) => s.id === section)) {
      setSection(visibleSections[0].id);
    }
  }, [visibleSections, section]);

  const { data: jobTitles = [] } = useGetJobTitlesQuery(undefined, { skip: !canJtRead });
  const sourceJobTitles = useMemo(
    () => jobTitles.filter((j) => Number(j.unitId) === Number(sourceUnitId) && j.isActive),
    [jobTitles, sourceUnitId],
  );

  const { data: commodities = [] } = useGetLttpCommoditiesQuery(sourceUnitId, {
    skip: !canCRead || sourceUnitId == null,
  });
  const { data: priceTables = [] } = useGetLttpPriceTablesQuery(
    { unitId: sourceUnitId },
    { skip: !canPRead || sourceUnitId == null },
  );

  const [jobTitlePick, setJobTitlePick] = useState("");
  const [commodityPick, setCommodityPick] = useState("");
  const [priceTablePick, setPriceTablePick] = useState("");
  const [priceApplyEffectiveDate, setPriceApplyEffectiveDate] = useState(() => localYmd());
  const [grantDataKind, setGrantDataKind] = useState("LTTP_COMMODITY");
  const [grantRecordScope, setGrantRecordScope] = useState("all");
  const [grantRecordPick, setGrantRecordPick] = useState("");
  const [pickedTargetIds, setPickedTargetIds] = useState(() => new Set());

  useEffect(() => {
    setPickedTargetIds(new Set());
  }, [section, sourceUnitId]);

  useEffect(() => {
    setGrantRecordPick("");
  }, [grantDataKind, grantRecordScope, section]);

  useEffect(() => {
    const t = priceTables.find((x) => String(x.id) === priceTablePick);
    if (t?.effectiveDate) {
      setPriceApplyEffectiveDate(String(t.effectiveDate).slice(0, 10));
    }
  }, [priceTablePick, priceTables]);

  const skipGrantBlock =
    section !== "privateGrants" || !canPrivateShare || sourceUnitId == null;

  const { data: grants = [], isFetching: grantsLoading } = useGetPrivateDataSharesQuery(sourceUnitId, {
    skip: skipGrantBlock,
  });
  const [createPrivateShare, { isLoading: creatingGrant }] = useCreatePrivateDataShareMutation();
  const [revokePrivateShare, { isLoading: revokingGrant }] = useRevokePrivateDataShareMutation();

  const canReadKindRecords =
    (grantDataKind === "LTTP_COMMODITY" && canCRead) ||
    (grantDataKind === "LTTP_PRICE_TABLE" && canPRead) ||
    (grantDataKind === "JOB_TITLE" && canJtRead);

  const { data: commoditiesForGrant = [] } = useGetLttpCommoditiesQuery(sourceUnitId, {
    skip:
      skipGrantBlock ||
      grantDataKind !== "LTTP_COMMODITY" ||
      !canCRead ||
      sourceUnitId == null,
  });
  const { data: priceTablesForGrant = [] } = useGetLttpPriceTablesQuery(
    { unitId: sourceUnitId },
    {
      skip:
        skipGrantBlock || grantDataKind !== "LTTP_PRICE_TABLE" || !canPRead || sourceUnitId == null,
    },
  );
  const { data: jobTitlesForGrant = [] } = useGetJobTitlesQuery(undefined, {
    skip: skipGrantBlock || grantDataKind !== "JOB_TITLE" || !canJtRead,
  });
  const sourceJobTitlesForGrant = useMemo(
    () =>
      jobTitlesForGrant.filter((j) => Number(j.unitId) === Number(sourceUnitId) && j.isActive),
    [jobTitlesForGrant, sourceUnitId],
  );

  const [applyJobTitle, { isLoading: applyingJt }] = useApplyJobTitleToUnitMutation();
  const [applyCommodity, { isLoading: applyingC }] = useApplyLttpCommodityToUnitMutation();
  const [applyPriceTable, { isLoading: applyingP }] = useApplyLttpPriceTableToUnitMutation();

  function toggleTarget(id) {
    const n = Number(id);
    setPickedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }
      return next;
    });
  }

  function selectAllDescendants() {
    setPickedTargetIds(new Set(descendantUnits.map((u) => Number(u.id))));
  }

  function clearTargets() {
    setPickedTargetIds(new Set());
  }

  const targetUnitIds = useMemo(() => [...pickedTargetIds], [pickedTargetIds]);
  const canApply = targetUnitIds.length > 0;

  async function onApplyJobTitles() {
    const id = jobTitlePick === "" ? NaN : Number(jobTitlePick);
    if (!Number.isFinite(id) || id <= 0) {
      notifyError("Chọn một chức danh ở đơn vị nguồn.");
      return;
    }
    if (!canApply) {
      notifyError("Chọn ít nhất một đơn vị con.");
      return;
    }
    try {
      await applyJobTitle({ id, targetUnitIds }).unwrap();
      notifySuccess(`Đã đồng bộ chức danh xuống ${targetUnitIds.length} đơn vị (liên kết fork — cập nhật từ đơn vị cha).`);
      clearTargets();
    } catch (err) {
      notifyError(err?.data?.message || "Không áp được chức danh.");
    }
  }

  async function onApplyCommodities() {
    const id = commodityPick === "" ? NaN : Number(commodityPick);
    if (!Number.isFinite(id) || id <= 0) {
      notifyError("Chọn một mặt hàng.");
      return;
    }
    if (!canApply) {
      notifyError("Chọn ít nhất một đơn vị con.");
      return;
    }
    try {
      await applyCommodity({ id, targetUnitIds, sourceUnitId }).unwrap();
      notifySuccess(`Đã đồng bộ mặt hàng xuống ${targetUnitIds.length} đơn vị.`);
      clearTargets();
    } catch (err) {
      notifyError(err?.data?.message || "Không áp được mặt hàng.");
    }
  }

  async function onCreatePrivateGrants() {
    if (!canApply) {
      notifyError("Chọn ít nhất một đơn vị con.");
      return;
    }
    if (!canReadKindRecords) {
      notifyError("Bạn cần quyền xem dữ liệu loại đã chọn để gán chia sẻ.");
      return;
    }
    if (grantRecordScope === "one") {
      const rid = grantRecordPick === "" ? NaN : Number(grantRecordPick);
      if (!Number.isFinite(rid) || rid <= 0) {
        notifyError("Chọn một bản ghi cụ thể hoặc để phạm vi «Toàn bộ loại».");
        return;
      }
    }
    try {
      await createPrivateShare({
        ownerUnitId: sourceUnitId,
        consumerUnitIds: targetUnitIds,
        dataKind: grantDataKind,
        recordId: grantRecordScope === "one" ? Number(grantRecordPick) : null,
      }).unwrap();
      notifySuccess(
        `Đã tạo gán chia sẻ cho ${targetUnitIds.length} đơn vị — đơn vị con có thể đọc dữ liệu private của bạn theo middleware phạm vi.`,
      );
      clearTargets();
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được gán chia sẻ.");
    }
  }

  async function onRevokeGrant(grantId) {
    try {
      await revokePrivateShare({ grantId, ownerUnitId: sourceUnitId }).unwrap();
      notifySuccess("Đã thu hồi gán chia sẻ.");
    } catch (err) {
      notifyError(err?.data?.message || "Không thu hồi được.");
    }
  }

  async function onApplyPriceTables() {
    const id = priceTablePick === "" ? NaN : Number(priceTablePick);
    if (!Number.isFinite(id) || id <= 0) {
      notifyError("Chọn một phiên bản bảng giá.");
      return;
    }
    if (!canApply) {
      notifyError("Chọn ít nhất một đơn vị con.");
      return;
    }
    try {
      await applyPriceTable({
        id,
        targetUnitIds,
        sourceUnitId,
        targetEffectiveDate: priceApplyEffectiveDate,
      }).unwrap();
      notifySuccess(
        `Đã đồng bộ bảng giá xuống ${targetUnitIds.length} đơn vị (ngày áp dụng đích: ${priceApplyEffectiveDate}).`,
      );
      clearTargets();
    } catch (err) {
      notifyError(err?.data?.message || "Không áp được bảng giá.");
    }
  }

  if (!visibleSections.length) {
    return (
      <Card className="shadow-soft">
        <CardContent className="!p-4">
          <p className="text-xs text-muted-foreground">
            Bạn cần quyền{" "}
            <span className="font-mono">units.privateDataShare.manage</span> để chia sẻ quyền đọc private, và/hoặc quyền
            đọc + quyền áp xuống đơn vị con (
            <span className="font-mono">jobTitles.applyDown</span>,{" "}
            <span className="font-mono">lttp.commodities.applyDown</span>,{" "}
            <span className="font-mono">lttp.prices.applyDown</span>) để đồng bộ fork.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="flex flex-col gap-3 !p-3 sm:!p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium sm:text-sm">Đồng bộ dữ liệu xuống đơn vị con</p>
          <p className="text-xs text-muted-foreground">
            Nguồn:{" "}
            {sourceUnitLabel ? (
              <span className="font-medium text-foreground">{sourceUnitLabel}</span>
            ) : (
              <span className="text-destructive">chưa xác định</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border/70 pb-2">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition sm:text-xs",
                section === s.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {sourceUnitId == null ? (
          <p className="text-xs text-destructive">
            Chưa có đơn vị nguồn — gán đơn vị hoặc chọn trên thanh phạm vi.
          </p>
        ) : descendantUnits.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Không có đơn vị cấp dưới (trong phạm vi danh sách hiện tại) để đồng bộ.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="h-8 text-xs" onClick={selectAllDescendants}>
                Chọn tất cả đơn vị con
              </Button>
              <Button type="button" variant="ghost" className="h-8 text-xs" onClick={clearTargets}>
                Bỏ chọn
              </Button>
            </div>

            <div className="max-h-[14rem] space-y-1.5 overflow-y-auto rounded-lg border border-border/60 p-2">
              {descendantUnits.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-border"
                    checked={pickedTargetIds.has(Number(u.id))}
                    onChange={() => toggleTarget(u.id)}
                  />
                  <span>
                    <span className="font-medium">{u.name}</span>
                    <span className="block text-[10px] text-muted-foreground">#{u.id}</span>
                  </span>
                </label>
              ))}
            </div>

            {section === "jobTitles" ? (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Chức danh tại đơn vị nguồn</span>
                  <select
                    className={inputClass}
                    value={jobTitlePick}
                    onChange={(e) => setJobTitlePick(e.target.value)}
                  >
                    <option value="">— Chọn chức danh —</option>
                    {sourceJobTitles.map((j) => (
                      <option key={j.id} value={String(j.id)}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  className="h-9 gap-1.5 text-xs"
                  disabled={!canApply || applyingJt || !jobTitlePick}
                  onClick={onApplyJobTitles}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  {applyingJt ? "Đang áp…" : `Áp xuống ${targetUnitIds.length} đơn vị`}
                </Button>
              </div>
            ) : null}

            {section === "commodities" ? (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Mặt hàng tại đơn vị nguồn</span>
                  <select
                    className={inputClass}
                    value={commodityPick}
                    onChange={(e) => setCommodityPick(e.target.value)}
                  >
                    <option value="">— Chọn mặt hàng —</option>
                    {commodities.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  className="h-9 gap-1.5 text-xs"
                  disabled={!canApply || applyingC || !commodityPick}
                  onClick={onApplyCommodities}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  {applyingC ? "Đang áp…" : `Áp xuống ${targetUnitIds.length} đơn vị`}
                </Button>
              </div>
            ) : null}

            {section === "priceTables" ? (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Phiên bản bảng giá (đơn vị nguồn)</span>
                  <select
                    className={inputClass}
                    value={priceTablePick}
                    onChange={(e) => setPriceTablePick(e.target.value)}
                  >
                    <option value="">— Chọn phiên bản —</option>
                    {priceTables.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.effectiveDate} ({t.rowCount ?? 0} dòng)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Ngày áp dụng tại đơn vị con
                  </span>
                  <input
                    type="date"
                    className={cn(inputClass, "w-auto min-w-[10.5rem]")}
                    value={priceApplyEffectiveDate}
                    onChange={(e) => setPriceApplyEffectiveDate(e.target.value)}
                    disabled={!priceTablePick}
                  />
                  <span className="block text-[10px] leading-snug text-muted-foreground">
                    Mặc định trùng ngày phiên bản nguồn; đổi nếu cần ghi bảng giá đích theo ngày khác (mỗi đơn vị chỉ một bản mỗi ngày).
                  </span>
                </label>
                <Button
                  type="button"
                  className="h-9 gap-1.5 text-xs"
                  disabled={!canApply || applyingP || !priceTablePick || !priceApplyEffectiveDate}
                  onClick={onApplyPriceTables}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  {applyingP ? "Đang áp…" : `Áp xuống ${targetUnitIds.length} đơn vị`}
                </Button>
              </div>
            ) : null}

            {section === "privateGrants" ? (
              <div className="space-y-3 border-t border-border/60 pt-3">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Gán quyền đọc theo <span className="font-mono">UnitPrivateDataShareGrant</span>: đơn vị con được phép dùng
                  dữ liệu private gốc tại đơn vị nguồn (một bản ghi hoặc cả loại). Thu hồi bằng nút bên bảng.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Loại dữ liệu</span>
                    <select
                      className={inputClass}
                      value={grantDataKind}
                      onChange={(e) => setGrantDataKind(e.target.value)}
                    >
                      {DATA_KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Phạm vi</span>
                    <select
                      className={inputClass}
                      value={grantRecordScope}
                      onChange={(e) => setGrantRecordScope(e.target.value)}
                    >
                      <option value="all">Toàn bộ loại (mọi bản ghi trong kho đơn vị nguồn)</option>
                      <option value="one">Một bản ghi cụ thể</option>
                    </select>
                  </label>
                </div>
                {grantRecordScope === "one" ? (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Bản ghi tại đơn vị nguồn</span>
                    {!canReadKindRecords ? (
                      <p className="text-[11px] text-destructive">Thiếu quyền xem loại dữ liệu này.</p>
                    ) : grantDataKind === "LTTP_COMMODITY" ? (
                      <select
                        className={inputClass}
                        value={grantRecordPick}
                        onChange={(e) => setGrantRecordPick(e.target.value)}
                      >
                        <option value="">— Chọn mặt hàng —</option>
                        {commoditiesForGrant.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    ) : grantDataKind === "LTTP_PRICE_TABLE" ? (
                      <select
                        className={inputClass}
                        value={grantRecordPick}
                        onChange={(e) => setGrantRecordPick(e.target.value)}
                      >
                        <option value="">— Chọn phiên bản bảng giá —</option>
                        {priceTablesForGrant.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.effectiveDate} ({t.rowCount ?? 0} dòng)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className={inputClass}
                        value={grantRecordPick}
                        onChange={(e) => setGrantRecordPick(e.target.value)}
                      >
                        <option value="">— Chọn chức danh —</option>
                        {sourceJobTitlesForGrant.map((j) => (
                          <option key={j.id} value={String(j.id)}>
                            {j.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                ) : null}
                <Button
                  type="button"
                  className="h-9 gap-1.5 text-xs"
                  disabled={
                    !canApply ||
                    creatingGrant ||
                    !canReadKindRecords ||
                    (grantRecordScope === "one" && grantRecordPick === "")
                  }
                  onClick={onCreatePrivateGrants}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  {creatingGrant ? "Đang tạo…" : `Tạo gán chia sẻ cho ${targetUnitIds.length} đơn vị`}
                </Button>

                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Gán hiện có {grantsLoading ? "(đang tải…)" : `(${grants.length})`}
                  </p>
                  <ResponsiveTableWrap className="max-h-[16rem] border-border/60">
                    <table className="w-full min-w-[480px] text-left text-[11px] sm:text-xs">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr>
                          <th className="p-2 font-medium">Đơn vị nhận</th>
                          <th className="p-2 font-medium">Loại</th>
                          <th className="p-2 font-medium">Bản ghi</th>
                          <th className="p-2 font-medium">Hiệu lực</th>
                          <th className="p-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {grants.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-3 text-muted-foreground">
                              Chưa có gán nào.
                            </td>
                          </tr>
                        ) : (
                          grants.map((g) => {
                            const active = g.validTo == null;
                            return (
                              <tr key={g.id} className="border-t border-border/50">
                                <td className="p-2">
                                  <span className="font-medium">{g.consumerUnitName ?? `#${g.consumerUnitId}`}</span>
                                  <span className="block text-[10px] text-muted-foreground">#{g.consumerUnitId}</span>
                                </td>
                                <td className="p-2">{dataKindLabel(g.dataKind)}</td>
                                <td className="p-2 text-muted-foreground">
                                  {g.recordId != null ? `#${g.recordId}` : "Toàn loại"}
                                </td>
                                <td className="p-2 text-[10px] text-muted-foreground">
                                  {g.validFrom?.slice(0, 10)} → {g.validTo ? g.validTo.slice(0, 10) : "…"}
                                  {active ? (
                                    <span className="ml-1 rounded bg-primary/15 px-1 text-primary">đang mở</span>
                                  ) : null}
                                </td>
                                <td className="p-2">
                                  {active ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                      disabled={revokingGrant}
                                      onClick={() => onRevokeGrant(g.id)}
                                    >
                                      Thu hồi
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </ResponsiveTableWrap>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
