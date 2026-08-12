type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="flex flex-1 flex-col p-8">
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-8 py-20 text-center shadow-sm">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
    </section>
  );
}
