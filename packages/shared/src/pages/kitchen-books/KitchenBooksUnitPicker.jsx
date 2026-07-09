"use client";

export function KitchenBooksUnitPicker({
  canPickUnits,
  sortedUnits,
  selectedUnitId,
  setManualUnitId,
  user,
  label = "Đơn vị",
}) {
  if (!canPickUnits) {
    return (
      <p className="text-sm text-muted-foreground">
        {label}: <span className="font-medium text-foreground">{user?.unit?.name ?? "—"}</span>
      </p>
    );
  }
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="min-w-[12rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={selectedUnitId ?? ""}
        onChange={(e) => setManualUnitId(Number(e.target.value))}
      >
        {sortedUnits.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
