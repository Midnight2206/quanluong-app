"use client";

import { Building2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  useLttpSupplierLinksQuery,
  useLttpSupplierMeQuery,
  usePatchLttpSupplierMeMutation,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { initialSupplierId, pairLabel } from "./supplierOrderView.js";

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";
const labelClass = "text-xs font-medium text-muted-foreground";

function toOptNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

/**
 * Hồ sơ đối tác LttpSupplier — NCC sửa, UI đơn vị đọc cùng bảng.
 */
export function SupplierPartnerProfileCard() {
  const { data: linksData, isLoading: linksLoading } = useLttpSupplierLinksQuery();
  const links = linksData?.links ?? [];
  const [supplierId, setSupplierId] = useState(null);
  const { data: profile, isLoading: profileLoading } = useLttpSupplierMeQuery(supplierId, {
    skip: supplierId == null,
  });
  const patchMe = usePatchLttpSupplierMeMutation();

  const [name, setName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [address, setAddress] = useState("");
  const [businessLicenseNo, setBusinessLicenseNo] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const next = initialSupplierId(links);
    if (next != null) setSupplierId(next);
  }, [links]);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setRepresentativeName(profile.representativeName ?? "");
    setAddress(profile.address ?? "");
    setBusinessLicenseNo(profile.businessLicenseNo ?? "");
    setTaxCode(profile.taxCode ?? "");
    setPhone(profile.phone ?? "");
    setEmail(profile.email ?? "");
  }, [profile]);

  async function onSave(e) {
    e.preventDefault();
    if (supplierId == null) return;
    if (!name.trim() || !representativeName.trim()) {
      notifyError("Tên nhà cung cấp và người đại diện là bắt buộc.");
      return;
    }
    try {
      await patchMe.mutateAsync({
        supplierId,
        body: {
          name: name.trim(),
          representativeName: representativeName.trim(),
          address: toOptNull(address),
          businessLicenseNo: toOptNull(businessLicenseNo),
          taxCode: toOptNull(taxCode),
          phone: toOptNull(phone),
          email: toOptNull(email),
        },
      });
      notifySuccess("Đã cập nhật hồ sơ nhà cung cấp.");
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được hồ sơ.");
    }
  }

  if (linksLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải hồ sơ nhà cung cấp…</p>;
  }
  if (links.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa gắn đối tác LTTP — liên hệ superadmin.
      </p>
    );
  }

  return (
    <Card className="border-border/80 shadow-soft">
      <CardContent className="space-y-3 !p-3 sm:!p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-4" aria-hidden />
          </div>
          <h2 className="text-base font-semibold tracking-tight">Hồ sơ nhà cung cấp</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Thông tin này đồng bộ lên giao diện đơn vị (đối tác LTTP).
        </p>

        {links.length > 1 ? (
          <label className="grid gap-1.5">
            <span className={labelClass}>Đối tác</span>
            <select
              className={fieldClass}
              value={supplierId == null ? "" : String(supplierId)}
              onChange={(e) => setSupplierId(e.target.value === "" ? null : Number(e.target.value))}
            >
              {links.map((link) => (
                <option key={`${link.level1UnitId}-${link.supplierId}`} value={String(link.supplierId)}>
                  {pairLabel(link)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className={cn(fieldClass, "flex items-center bg-muted/40")}>{pairLabel(links[0])}</p>
        )}

        {profileLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSave}>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className={labelClass}>Tên nhà cung cấp *</span>
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className={labelClass}>Người đại diện *</span>
              <input
                className={fieldClass}
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className={labelClass}>Địa chỉ</span>
              <input className={fieldClass} value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Mã số thuế</span>
              <input className={fieldClass} value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Số GPKD</span>
              <input
                className={fieldClass}
                value={businessLicenseNo}
                onChange={(e) => setBusinessLicenseNo(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Số điện thoại</span>
              <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Email</span>
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={patchMe.isPending} className="h-10 gap-2">
                {patchMe.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Lưu hồ sơ đối tác
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
