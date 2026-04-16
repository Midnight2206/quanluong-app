import { EmptyState } from "./empty-state";

export const ListStateSwitch = ({
  isLoading,
  isFetching,
  isError,
  items,
  loadingFallback,
  errorFallback,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}) => {
  const hasItems = Array.isArray(items) && items.length > 0;

  if (isLoading && !hasItems) {
    return loadingFallback;
  }

  if (isError && !hasItems) {
    return errorFallback;
  }

  if (!isLoading && !isError && !hasItems) {
    return (
      <EmptyState
        action={emptyAction}
        description={emptyDescription}
        title={emptyTitle}
      />
    );
  }

  return (
    <div className="space-y-3">
      {isFetching && hasItems ? (
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          Refreshing data...
        </div>
      ) : null}
      {children}
    </div>
  );
};
