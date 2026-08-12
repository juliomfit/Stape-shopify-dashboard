type HeaderProps = {
  title: string;
  description?: string;
};

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="border-b border-border bg-surface/90 px-8 py-6 backdrop-blur">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}
