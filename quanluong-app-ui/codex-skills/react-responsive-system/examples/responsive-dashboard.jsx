export function ResponsiveDashboardExample() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Dashboard</p>
          <h1 className="text-2xl font-semibold">Tong quan he thong</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button">Refresh</button>
          <button type="button">Export</button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>Metric 1</div>
        <div>Metric 2</div>
        <div>Metric 3</div>
        <div>Metric 4</div>
      </div>
    </section>
  );
}
