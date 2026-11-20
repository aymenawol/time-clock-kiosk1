import { cn } from "@/lib/cn";
import { type PaperItem, type PaperSectionData } from "@/lib/inspection";

/**
 * One section of the paper inspection form: a heading, then the paper's two
 * columns of items, each with a Pre-Trip and a Post-Trip box. On a phone the
 * columns stack (left items, then right items). Used by the driver form and by
 * the read-only sheet, which supply the boxes.
 */
export function PaperSection<T extends PaperItem>({
  section,
  renderBoxes,
  renderExtra,
  renderBelow,
  actions,
  dense,
}: {
  section: PaperSectionData<T>;
  /** The Pre-Trip and Post-Trip cells for an item (two elements of width `cellWidth`). */
  renderBoxes: (item: T) => React.ReactNode;
  /** Something between the label and the boxes, such as the PSI field. */
  renderExtra?: (item: T) => React.ReactNode;
  /** Something under the row, such as the note for an X. */
  renderBelow?: (item: T) => React.ReactNode;
  actions?: React.ReactNode;
  dense?: boolean;
}) {
  const cols = [section.left, section.right].filter((c) => c.length);
  return (
    <section aria-labelledby={`sec-${slug(section.title)}`} className="paper-section break-inside-avoid">
      <div className="flex items-center justify-between gap-2 border-y border-border-strong bg-surface-2 px-3 py-1.5">
        <h3 id={`sec-${slug(section.title)}`} className="text-sm font-bold tracking-wide text-fg">
          {section.title.toUpperCase()}
        </h3>
        {actions}
      </div>
      <div className={cn("grid", cols.length > 1 && "md:grid-cols-2 md:divide-x md:divide-border-strong")}>
        {cols.map((items, ci) => (
          <div key={ci} className="min-w-0">
            <div
              className={cn("flex items-end justify-end gap-1.5 border-b border-border px-3 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted", dense && "gap-1")}
              aria-hidden
            >
              <span className={cn("text-center", dense ? "w-11" : "w-14")}>Pre-Trip</span>
              <span className={cn("text-center", dense ? "w-11" : "w-14")}>Post-Trip</span>
            </div>
            <ul>
              {items.map((it, i) => (
                <li key={it.id} id={`item-${it.id}`} className="scroll-mt-20 border-b border-border px-3 py-1.5">
                  {it.subgroup && it.subgroup !== items[i - 1]?.subgroup ? (
                    <p className="pb-0.5 text-xs font-bold text-fg">({it.subgroup})</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn("leading-tight text-fg", it.mini ? "font-bold" : "font-normal", dense ? "text-[12px]" : "text-[15px]")}>
                        {it.mini ? "*" : ""}
                        {it.label}
                      </p>
                      {it.hint ? <p className="text-[11px] leading-tight text-muted">{it.hint}</p> : null}
                    </div>
                    {renderExtra?.(it)}
                    <div className={cn("flex shrink-0 gap-1.5", dense && "gap-1")}>{renderBoxes(it)}</div>
                  </div>
                  {renderBelow?.(it)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** A box on the form. */
export function PaperBox({
  children,
  shaded,
  dense,
  className,
}: {
  children?: React.ReactNode;
  shaded?: boolean;
  dense?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[3px] border border-border-strong text-sm font-bold tabular",
        dense ? "h-7 w-11" : "h-11 w-14",
        // Shaded like the paper's blacked-out box; softened on screen so it never reads as a button.
        shaded ? "border-fg/70 bg-fg/70 print:border-black print:bg-black" : "bg-surface",
        className,
      )}
    >
      {children}
    </span>
  );
}
