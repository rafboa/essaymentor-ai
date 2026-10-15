/** Title block for the reading pages. */
export function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="border-b border-rule pb-10">
      <h1 className="max-w-4xl font-display text-[clamp(2.75rem,6vw,5rem)] font-extrabold uppercase leading-[0.96] [font-variation-settings:'opsz'_72] [text-wrap:balance]">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">{sub}</p>
    </header>
  );
}
