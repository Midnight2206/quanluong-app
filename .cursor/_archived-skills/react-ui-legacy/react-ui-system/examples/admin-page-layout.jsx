import { PageSection } from "../templates/page-section-pattern";

export const PayrollOverviewPage = () => {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Payroll Overview</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Review recent payroll runs and approval status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button">Export</button>
          <button type="button">Create run</button>
        </div>
      </header>

      <PageSection
        description="Track the current payroll cycle and related actions."
        title="Current cycle"
      >
        <p>Content goes here.</p>
      </PageSection>

      <PageSection
        description="Latest activity and summaries."
        title="Recent activity"
      >
        <p>Content goes here.</p>
      </PageSection>
    </div>
  );
};
