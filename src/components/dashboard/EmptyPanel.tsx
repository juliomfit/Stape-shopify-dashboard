type EmptyPanelProps = {
  title: string;
  description: string;
};

export function EmptyPanel({ title, description }: EmptyPanelProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-6 flex min-h-48 items-center justify-center rounded-xl bg-accent-soft/60 px-6 py-10 text-center">
        <p className="max-w-sm text-sm leading-6 text-muted">{description}</p>
      </div>
    </article>
  );
}
