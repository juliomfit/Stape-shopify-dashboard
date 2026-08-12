type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="flex flex-1 flex-col">
      <div className="m-8 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-surface px-8 py-16 text-center">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
    </section>
  );
}
