import { cn } from "@/utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-5", className)} {...props} />;
}

