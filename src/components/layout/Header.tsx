type HeaderProps = {
  title: string;
  description?: string;
};

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="border-b border-border bg-surface px-8 py-5">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
    </header>
  );
}
