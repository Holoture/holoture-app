/**
 * Shared landing-page section header: a hairline vertical rule in the left
 * gutter with a mono section index running down it, header left-aligned
 * beside it — replacing the previous centered-header pattern used
 * identically across every section (the strongest "template" tell on the
 * page). Used for the three narrative sections (platform, how it works,
 * proof); pricing stays centered since it's a grid/action moment, not part
 * of the narrative sequence.
 */
export default function SectionHeader({
  index,
  eyebrow,
  title,
  subhead,
}: {
  index: string
  eyebrow: string
  title: string
  subhead?: string
}) {
  return (
    <div className="flex items-stretch gap-4 sm:gap-6 mb-14 max-w-2xl">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <span className="data-label" style={{ color: '#009BFF' }}>{index}</span>
        <div className="flex-1 w-px mt-3" style={{ backgroundColor: 'var(--line)', minHeight: 24 }} />
      </div>
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="type-h2">{title}</h2>
        {subhead && <p className="mt-3 type-subhead">{subhead}</p>}
      </div>
    </div>
  )
}
