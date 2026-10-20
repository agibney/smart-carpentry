// Dashboard summary tile, from the card markup on Sakai's demo dashboard. `value` is optional
// so a tile can be laid out before its data source exists — it renders as a dash until then.
type Props = {
  title: string
  icon: string
  value?: string | number
  caption: string
}

export function StatCard({ title, icon, value, caption }: Props) {
  return (
    <div className="card mb-0 h-full">
      <div className="flex justify-content-between mb-3">
        <div>
          <span className="block text-500 font-medium mb-3">{title}</span>
          <div className="text-900 font-medium text-xl">{value ?? '—'}</div>
        </div>
        <div className="flex align-items-center justify-content-center bg-primary-100 border-round w-3rem h-3rem">
          <i className={`${icon} text-primary text-xl`} />
        </div>
      </div>
      <span className="text-500">{caption}</span>
    </div>
  )
}
