import { Button } from "../templates/button";

export const DashboardCard = () => {
  return (
    <section className="rounded-[var(--radius)] border bg-[hsl(var(--card))] p-6 text-[hsl(var(--card-foreground))] shadow-[var(--shadow-md)]">
      <div className="mb-4 space-y-1">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Monthly payroll
        </p>
        <h2 className="text-2xl font-semibold">128,000,000 VND</h2>
      </div>

      <div className="flex items-center gap-3">
        <Button>Review</Button>
        <Button variant="outline">Export</Button>
      </div>
    </section>
  );
};
