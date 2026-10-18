export const PageSection = ({
  title,
  description,
  actions = null,
  children,
}) => {
  return (
    <section className="rounded-[var(--radius)] border bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[hsl(var(--card-foreground))]">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <div>{children}</div>
    </section>
  );
};
