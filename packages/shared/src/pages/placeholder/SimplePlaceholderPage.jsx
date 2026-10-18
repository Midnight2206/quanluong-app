import { Card, CardContent } from "@/components/ui/Card";

export function SimplePlaceholderPage({ title, description }) {
  return (
    <section className="space-y-6">
      <div data-sticky-level="0" className="unified-sticky-surface py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Trang đang được xây dựng. Quay lại sau để sử dụng đầy đủ tính năng.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
