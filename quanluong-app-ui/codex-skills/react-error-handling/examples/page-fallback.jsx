import { ErrorBoundary } from "../templates/error-boundary";

const SectionFallback = () => {
  return (
    <div className="rounded-[var(--radius)] border bg-[hsl(var(--card))] p-6">
      <h2 className="text-lg font-semibold">Could not load this section</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Please refresh the page or try again later.
      </p>
    </div>
  );
};

export const PayrollPageSection = ({ children }) => {
  return <ErrorBoundary fallback={<SectionFallback />}>{children}</ErrorBoundary>;
};
