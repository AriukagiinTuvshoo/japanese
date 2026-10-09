interface EntryStep {
  href: string;
  title: string;
  subtitle: string;
}

interface EntryNavigatorProps {
  previous: EntryStep | null;
  next: EntryStep | null;
  previousLabel: string;
  nextLabel: string;
  positionLabel: string;
}

const stepClass = "card-flat flex min-w-0 flex-col justify-center rounded-xl px-3 py-2.5 transition hover:border-shu-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shu-500";

function Step({ item, label, direction }: { item: EntryStep | null; label: string; direction: "previous" | "next" }) {
  const arrow = direction === "previous" ? "←" : "→";
  const content = (
    <>
      <span className="text-[10.5px] font-bold text-sumi-500">{arrow} {label}</span>
      {item ? (
        <>
          <span className="mt-0.5 truncate font-jp text-[16px] font-bold text-sumi-900">{item.title}</span>
          <span className="truncate text-[11px] text-sumi-500">{item.subtitle}</span>
        </>
      ) : (
        <span className="mt-0.5 text-[12px] text-sumi-400">—</span>
      )}
    </>
  );

  if (!item) {
    return <button type="button" disabled aria-label={label} className={`${stepClass} cursor-not-allowed opacity-50`}>{content}</button>;
  }

  return <a href={item.href} aria-label={`${label}: ${item.title}`} className={stepClass}>{content}</a>;
}

export function EntryNavigator({ previous, next, previousLabel, nextLabel, positionLabel }: EntryNavigatorProps) {
  return (
    <nav aria-label={`${previousLabel} / ${nextLabel}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
      <Step item={previous} label={previousLabel} direction="previous" />
      <span aria-live="polite" className="self-center whitespace-nowrap text-[10.5px] font-mono tabnum text-sumi-400">{positionLabel}</span>
      <Step item={next} label={nextLabel} direction="next" />
    </nav>
  );
}
