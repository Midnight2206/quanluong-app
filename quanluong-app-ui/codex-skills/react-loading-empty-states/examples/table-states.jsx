import { EmptyState } from "../templates/empty-state";
import { ListStateSwitch } from "../templates/list-state-switch";

const TableSkeleton = () => {
  return (
    <div className="rounded-[var(--radius)] border bg-[hsl(var(--card))] p-6">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-[hsl(var(--muted))]" />
        <div className="h-10 rounded bg-[hsl(var(--muted))]" />
        <div className="h-10 rounded bg-[hsl(var(--muted))]" />
        <div className="h-10 rounded bg-[hsl(var(--muted))]" />
      </div>
    </div>
  );
};

const ErrorFallback = () => {
  return (
    <EmptyState
      title="Could not load data"
      description="Please try again or come back later."
    />
  );
};

export const UsersTableState = ({
  data = [],
  isLoading,
  isFetching,
  isError,
  children,
}) => {
  return (
    <ListStateSwitch
      emptyDescription="There are no users to display yet."
      emptyTitle="No users found"
      errorFallback={<ErrorFallback />}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      items={data}
      loadingFallback={<TableSkeleton />}
    >
      {children}
    </ListStateSwitch>
  );
};
