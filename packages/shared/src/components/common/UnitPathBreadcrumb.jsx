import { cn } from "@/utils/cn";

/**
 * Renders materialized unit path from API `unitPath`: [{ id, name }, ...].
 */
export function UnitPathBreadcrumb({ unitPath, className }) {
  if (!unitPath?.length) {
    return null;
  }

  const label = unitPath.map((u) => u.name).filter(Boolean).join(" / ");

  if (!label) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-[11px] leading-snug text-muted-foreground sm:text-xs",
        className,
      )}
      title={label}
    >
      {label}
    </p>
  );
}
