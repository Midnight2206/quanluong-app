export const RefreshBanner = ({ isFetching }) => {
  if (!isFetching) {
    return null;
  }

  return (
    <div className="rounded-[var(--radius)] bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
      Updating data...
    </div>
  );
};
