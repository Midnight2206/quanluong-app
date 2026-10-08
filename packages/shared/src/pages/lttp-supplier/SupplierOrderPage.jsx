"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import {
  useLttpSupplierLinksQuery,
  useLttpSupplierOrdersQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { buildOrderingMatrix } from "@/pages/lttpNhapXuat/lttpOrderingMatrix.js";
import {
  filterOrderSummaryByRecipientUnits,
  initialSupplierId,
  pairLabel,
  recipientKeys,
} from "./supplierOrderView.js";
import { captureElementToPngBlob } from "@/utils/captureElementToPng";

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function SupplierOrderPage() {
  const tableRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [orderDate, setOrderDate] = useState(() => todayIsoDate());
  const [supplierId, setSupplierId] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [imageUrl, setImageUrl] = useState("");

  const { data: linksData, isLoading: linksLoading, error: linksError } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];

  useEffect(() => {
    const nextSupplierId = initialSupplierId(links);
    if (nextSupplierId != null) {
      setSupplierId(nextSupplierId);
      return;
    }
    if (supplierId != null && !links.some((link) => Number(link?.supplierId) === Number(supplierId))) {
      setSupplierId(null);
    }
  }, [links, supplierId]);

  const {
    data: summary,
    isLoading: ordersLoading,
    isFetching: ordersFetching,
    error: ordersError,
  } = useLttpSupplierOrdersQuery(
    { date: orderDate, supplierId },
    { skip: supplierId == null },
  );

  const availableRecipientKeys = useMemo(() => recipientKeys(summary), [summary]);

  useEffect(() => {
    setSelectedKeys(availableRecipientKeys);
  }, [availableRecipientKeys]);

  const recipientOptions = useMemo(() => {
    const labels = new Map();
    for (const col of summary?.slipColumns ?? []) {
      const key = String(col?.recipientUnitId ?? "none");
      if (!labels.has(key)) {
        labels.set(key, col?.recipientUnitName ?? "Chưa rõ đơn vị nhận");
      }
    }
    return availableRecipientKeys.map((key) => ({
      key,
      label: labels.get(key) ?? "Chưa rõ đơn vị nhận",
    }));
  }, [availableRecipientKeys, summary]);

  const filteredSummary = useMemo(
    () => filterOrderSummaryByRecipientUnits(summary, selectedKeys),
    [summary, selectedKeys],
  );
  const matrix = useMemo(
    () => (selectedKeys.length > 0 ? buildOrderingMatrix(filteredSummary) : null),
    [filteredSummary, selectedKeys],
  );

  useEffect(() => {
    let active = true;

    async function capturePreview() {
      if (!matrix?.rows?.length || selectedKeys.length === 0 || !tableRef.current) {
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return "";
        });
        return;
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const blob = await captureElementToPngBlob(tableRef.current, { qualityMode: "fast" });
      const nextUrl = URL.createObjectURL(blob);
      if (!active) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    }

    capturePreview().catch(() => {
      if (!active) return;
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    });

    return () => {
      active = false;
    };
  }, [orderDate, supplierId, selectedKeys, matrix]);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const showLoader = linksLoading || ordersLoading || ordersFetching;

  if (linksLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }

  if (linksError) {
    return <p className="text-sm text-destructive">Không tải được danh sách nhà cung cấp.</p>;
  }

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">Superadmin chưa gắn nhà cung cấp.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Đặt hàng trong ngày</h1>
        <p className="text-sm text-muted-foreground">Trang xem nhanh theo nhà cung cấp và đơn vị nhận.</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1" htmlFor="supplier-order-date">
              <span className="text-xs font-medium text-foreground">Ngày</span>
              <input
                id="supplier-order-date"
                type="date"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value || todayIsoDate())}
              />
            </label>

            {links.length > 1 ? (
              <label className="space-y-1" htmlFor="supplier-order-link">
                <span className="text-xs font-medium text-foreground">Đơn vị và nhà cung cấp</span>
                <select
                  id="supplier-order-link"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  value={supplierId == null ? "" : String(supplierId)}
                  onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
                  required
                >
                  <option value="">Chọn đơn vị và nhà cung cấp</option>
                  {links.map((link) => (
                    <option key={`${link.level1UnitId}-${link.supplierId}`} value={String(link.supplierId)}>
                      {pairLabel(link)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Đơn vị và nhà cung cấp</p>
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {pairLabel(links[0])}
                </p>
              </div>
            )}
          </div>

          {supplierId == null ? (
            <p className="text-sm text-muted-foreground">Chọn đơn vị và nhà cung cấp.</p>
          ) : null}

          {ordersError ? <p className="text-sm text-destructive">Không tải được đặt hàng.</p> : null}

          {showLoader && supplierId != null ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}

          {recipientOptions.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Đơn vị nhận</legend>
              <div className="flex flex-wrap gap-2">
                {recipientOptions.map((option) => {
                  const checked = selectedKeys.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedKeys((prev) =>
                            e.target.checked ? [...prev, option.key] : prev.filter((key) => key !== option.key),
                          );
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {supplierId != null && recipientOptions.length > 0 && selectedKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chọn ít nhất một đơn vị nhận.</p>
          ) : null}
        </CardContent>
      </Card>

      {supplierId != null && selectedKeys.length > 0 && matrix?.rows?.length ? (
        <>
          <Card>
            <CardContent className="space-y-4">
              <div ref={tableRef} className="space-y-4 rounded-xl bg-background">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">Bảng đặt hàng</h2>
                  <p className="text-sm text-muted-foreground">{orderDate}</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="border-b border-r border-border px-3 py-2 text-left font-semibold text-foreground">
                          Mặt hàng
                        </th>
                        <th className="border-b border-r border-border px-3 py-2 text-center font-semibold text-foreground">
                          ĐVT
                        </th>
                        {matrix.columns.map((col) => (
                          <th
                            key={col.key}
                            className="border-b border-r border-border px-3 py-2 text-center font-semibold text-foreground last:border-r-0"
                          >
                            <div className="text-xs font-medium text-muted-foreground">{col.refLabel}</div>
                            <div>{col.recipientUnitName}</div>
                          </th>
                        ))}
                        <th className="border-b border-border px-3 py-2 text-center font-semibold text-foreground">Tổng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((row) => (
                        <tr key={row.commodityId} className="odd:bg-background even:bg-muted/20">
                          <td className="border-r border-t border-border px-3 py-2 text-foreground">{row.name}</td>
                          <td className="border-r border-t border-border px-3 py-2 text-center text-muted-foreground">
                            {row.measureUnit || "—"}
                          </td>
                          {matrix.columns.map((col) => {
                            const cell = matrix.qtyBySlip.get(col.key)?.get(row.commodityId);
                            return (
                              <td
                                key={`${row.commodityId}-${col.key}`}
                                className="border-r border-t border-border px-3 py-2 text-center text-foreground last:border-r-0"
                              >
                                <div className="font-medium">{cell?.quantityFormatted ?? "—"}</div>
                                {cell?.lineNote ? (
                                  <div className="text-xs text-muted-foreground">({cell.lineNote})</div>
                                ) : null}
                              </td>
                            );
                          })}
                          <td className="border-t border-border px-3 py-2 text-center font-semibold text-foreground">
                            {row.quantityFormatted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {imageUrl ? (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Ảnh xem trước</h2>
                <img alt="Ảnh đặt hàng" src={imageUrl} className="w-full rounded-xl border border-border" />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {supplierId != null && selectedKeys.length > 0 && !showLoader && !ordersError && !matrix?.rows?.length ? (
        <p className="text-sm text-muted-foreground">Không có đặt hàng trong ngày này.</p>
      ) : null}
    </div>
  );
}
