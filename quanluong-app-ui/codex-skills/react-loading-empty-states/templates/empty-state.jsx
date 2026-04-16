export const EmptyState = ({
  title = "No data available",
  description = "There is nothing to show here yet.",
  action = null,
}) => {
  return (
    <div className="rounded-[var(--radius)] border bg-[hsl(var(--card))] p-8 text-center shadow-[var(--shadow-sm)]">
      <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
        {title}
      </h2>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};
