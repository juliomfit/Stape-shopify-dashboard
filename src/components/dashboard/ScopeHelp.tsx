type ScopeHelpProps = {
  title: string;
  steps: string[];
};

export function ScopeHelp({ title, steps }: ScopeHelpProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </article>
  );
}
