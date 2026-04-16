import { Card, CardContent } from "@/components/ui/Card";

export function SimplePlaceholderPage({ title, description }) {
  return (
    <section className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain">
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Trang đang được xây dựng. Quay lại sau để sử dụng đầy đủ tính năng.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
