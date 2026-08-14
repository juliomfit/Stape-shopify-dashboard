type InfoPanelProps = {
  title: string;
  items: string[];
};

export function InfoPanel({ title, items }: InfoPanelProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
